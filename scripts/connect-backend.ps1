<#
.SYNOPSIS
  Provisions and connects the lead-system backend, end to end.

.DESCRIPTION
  Everything that can be automated is automated. Run this on the machine that
  has network access to Supabase and holds GEMINI_API_KEY in its environment.

  It will:
    1. check prerequisites and that GEMINI_API_KEY is visible (SET / MISSING only)
    2. link this repository to your Supabase project
    3. apply the database migrations
    4. push the server secrets to Supabase
    5. deploy both Edge Functions
    6. read back the PUBLIC anon key and write it into assets/js/config.js
    7. re-stamp the asset hashes, commit and push

  Secrets are read as hidden input, passed straight to `supabase secrets set`,
  and never written to a file, echoed, or logged. GEMINI_API_KEY is taken from
  your environment and is never displayed.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\connect-backend.ps1
#>
[CmdletBinding()]
param(
  # Your Supabase project reference, the subdomain of the project URL.
  [string] $ProjectRef,
  # Where lead notifications are sent.
  [string] $AdminEmail,
  # Stop before committing, so you can inspect the change first.
  [switch] $NoCommit
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Step($n, $text) { Write-Host "`n[$n] $text" -ForegroundColor Cyan }
function Ok($text)       { Write-Host "    OK  $text" -ForegroundColor Green }
function Warn($text)     { Write-Host "    !   $text" -ForegroundColor Yellow }
function Die($text)      { Write-Host "`nSTOPPED: $text" -ForegroundColor Red; exit 1 }

# ── 1. Prerequisites ────────────────────────────────────────────────────────
Step 1 'Checking prerequisites'

foreach ($cmd in @('git', 'supabase')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Die "$cmd is not on PATH. Install the Supabase CLI with:  npm i -g supabase"
  }
  Ok "$cmd found"
}

# SET / MISSING only. The value is never printed.
if ($env:GEMINI_API_KEY) {
  Ok 'GEMINI_API_KEY=SET'
} else {
  Die @'
GEMINI_API_KEY=MISSING in this shell.

`setx` only affects NEW processes, so a shell opened before you set it will
not see it. Open a fresh PowerShell window and run this script again. To
confirm without printing the value:

    if ($env:GEMINI_API_KEY) { "SET" } else { "MISSING" }
'@
}

if (-not (Test-Path 'backend/supabase/migrations')) {
  Die "Run this from the repository. Expected backend/supabase/migrations to exist."
}
Ok 'repository layout looks right'

# ── 2. Link the project ─────────────────────────────────────────────────────
Step 2 'Linking the Supabase project'

if (-not $ProjectRef) {
  Write-Host '    Your project reference is the subdomain of the project URL:'
  Write-Host '      https://<project-ref>.supabase.co' -ForegroundColor DarkGray
  $ProjectRef = (Read-Host '    Project ref').Trim()
}
if ($ProjectRef -notmatch '^[a-z0-9]{16,32}$') {
  Die "That does not look like a project ref: '$ProjectRef'"
}

Push-Location 'backend'
try {
  # `supabase login` opens a browser the first time; it is a no-op afterwards.
  supabase projects list *> $null
  if ($LASTEXITCODE -ne 0) {
    Warn 'Not signed in. A browser window will open.'
    supabase login
    if ($LASTEXITCODE -ne 0) { Die 'supabase login failed.' }
  }
  supabase link --project-ref $ProjectRef
  if ($LASTEXITCODE -ne 0) { Die 'supabase link failed.' }
  Ok "linked to $ProjectRef"

  # ── 3. Migrations ────────────────────────────────────────────────────────
  Step 3 'Applying database migrations'
  supabase db push
  if ($LASTEXITCODE -ne 0) { Die 'supabase db push failed. Nothing was deployed.' }
  Ok 'portfolio_leads, admin_users, RLS policies and the throttle applied'

  # ── 4. Secrets ───────────────────────────────────────────────────────────
  Step 4 'Setting server-side secrets'

  if (-not $AdminEmail) { $AdminEmail = (Read-Host '    Email to send lead notifications to').Trim() }
  if ($AdminEmail -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { Die "Not a valid email: '$AdminEmail'" }

  Write-Host '    Resend API key (input hidden; leave blank to skip email for now)'
  $resendSecure = Read-Host '    RESEND_API_KEY' -AsSecureString
  $resend = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
              [Runtime.InteropServices.Marshal]::SecureStringToBSTR($resendSecure))

  # A long random salt so the throttle table never has to store an IP.
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $salt = -join ($bytes | ForEach-Object { $_.ToString('x2') })

  $pagesOrigin = 'https://mohamedgamal-attia.github.io'
  $siteUrl     = "$pagesOrigin/mohamed_gamal_portfolio/"

  $secretArgs = @(
    "GEMINI_API_KEY=$($env:GEMINI_API_KEY)",
    "ADMIN_NOTIFICATION_EMAIL=$AdminEmail",
    "THROTTLE_SALT=$salt",
    "ALLOWED_ORIGINS=$pagesOrigin",
    "PUBLIC_SITE_URL=$siteUrl",
    "PUBLIC_ADMIN_URL=${siteUrl}admin.html"
  )
  if ($resend) { $secretArgs += "RESEND_API_KEY=$resend" }

  # The anon key is needed by resend-notification to verify an admin's token.
  $anonKey = (supabase projects api-keys --project-ref $ProjectRef --output json |
              ConvertFrom-Json | Where-Object { $_.name -eq 'anon' }).api_key
  if (-not $anonKey) { Die 'Could not read the project anon key from the CLI.' }
  $secretArgs += "SUPABASE_ANON_KEY=$anonKey"

  supabase secrets set @secretArgs *> $null
  if ($LASTEXITCODE -ne 0) { Die 'supabase secrets set failed.' }
  $resend = $null; $secretArgs = $null   # drop the plaintext promptly
  Ok ('secrets set: GEMINI_API_KEY, ADMIN_NOTIFICATION_EMAIL, THROTTLE_SALT, ' +
      'ALLOWED_ORIGINS, PUBLIC_SITE_URL, PUBLIC_ADMIN_URL, SUPABASE_ANON_KEY' +
      $(if ($resendSecure.Length) { ', RESEND_API_KEY' } else { ' (RESEND_API_KEY skipped)' }))

  # ── 5. Functions ─────────────────────────────────────────────────────────
  Step 5 'Deploying Edge Functions'
  foreach ($fn in @('project-estimate', 'resend-notification')) {
    supabase functions deploy $fn
    if ($LASTEXITCODE -ne 0) { Die "supabase functions deploy $fn failed." }
    Ok "$fn deployed"
  }
}
finally { Pop-Location }

# ── 6. Public config ────────────────────────────────────────────────────────
Step 6 'Writing the public values into assets/js/config.js'

$cfgPath = 'assets/js/config.js'
$cfg = Get-Content $cfgPath -Raw -Encoding UTF8
$base = "https://$ProjectRef.supabase.co"

$replacements = [ordered]@{
  'endpoint'        = "$base/functions/v1/project-estimate"
  'resendEndpoint'  = "$base/functions/v1/resend-notification"
  'supabaseUrl'     = $base
  'supabaseAnonKey' = $anonKey
}
foreach ($k in $replacements.Keys) {
  $value = $replacements[$k]
  # Anchored to the leadSystem block's indentation so it cannot match a
  # same-named key elsewhere. [regex]::Replace has no (input, pattern,
  # evaluator, count) overload - a trailing 1 binds to RegexOptions, not a
  # count - so the Regex instance is constructed to do a single replacement.
  $rx = [regex]::new("(?m)^(\s{4}$k\s*:\s*)'[^']*'")
  $found = $rx.Matches($cfg)
  if ($found.Count -ne 1) {
    Die "Expected exactly one '$k' entry in $cfgPath, found $($found.Count). Nothing was written."
  }
  $cfg = $rx.Replace($cfg, { param($m) "$($m.Groups[1].Value)'$value'" }, 1)
}
Set-Content $cfgPath $cfg -NoNewline -Encoding UTF8
Ok 'endpoint, resendEndpoint, supabaseUrl and supabaseAnonKey written (all public values)'

# ── 7. Stamp, verify, commit ───────────────────────────────────────────────
Step 7 'Re-stamping asset hashes'
python scripts/version_assets.py
if ($LASTEXITCODE -ne 0) { Die 'version_assets.py reported an unversioned asset link.' }

Step 8 'Checking no secret reached the public config'
$leak = Select-String -Path $cfgPath -Pattern 'service_role','AIza','^re_','TURNSTILE_SECRET_KEY\s*:' -AllMatches
if ($leak) { Die "A secret-shaped value is in $cfgPath. Nothing was committed." }
Ok 'config.js holds only public values'

if ($NoCommit) {
  Write-Host "`nStopped before committing, as asked. Review with:  git diff" -ForegroundColor Yellow
  exit 0
}

Step 9 'Committing and pushing'
# version_assets.py DISCOVERS pages, so a fixed list would miss a page added
# later: stamped but never staged. Stage the config plus every modified page.
git add assets/js/config.js
git add -u -- '*.html'
# "nothing to commit" is the one benign non-zero exit; anything else is a
# real failure and must not be pushed over.
$staged = git diff --cached --name-only
if (-not $staged) {
  Warn 'Nothing staged - config.js already holds these values.'
} else {
  git commit -m "[FIX] Portfolio: connect live project request backend

Points the request wizard and the admin dashboard at the deployed Supabase
project. Public values only: the function URLs, the project URL and the anon
key, which grants nothing on its own because portfolio_leads has RLS on with
no policy for the anonymous role.

Generated by scripts/connect-backend.ps1."
  if ($LASTEXITCODE -ne 0) { Die 'git commit failed. Nothing was pushed.' }
}
git push origin main
if ($LASTEXITCODE -ne 0) { Die 'git push failed.' }

Write-Host "`nConnected." -ForegroundColor Green
Write-Host @"

Two things left that only you can do:

  1. Create your admin login:
     Supabase dashboard -> Authentication -> Users -> Add user
     (tick Auto Confirm User), copy the UID, then in SQL Editor:

       insert into public.admin_users (user_id, email)
       values ('<the-uid>', '$AdminEmail');

  2. Wait about a minute for GitHub Pages to rebuild, then verify:

       node scripts/verify-backend.mjs

"@ -ForegroundColor Cyan
