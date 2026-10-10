import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');

/* Terms that are legitimately Latin inside Arabic UI:
   product/brand names, company names, technical identifiers, units. */
const ALLOW = new RegExp('^(?:' + [
 'Odoo(?:\\s*(?:1[4-9]|20|17/18|Enterprise))?','Python','PostgreSQL','QWeb','REST(?:\\s*API)?','JSON-RPC',
 'JavaScript','SCSS','CSS','XML','SQL','JSON','RPC','JSON-RPC','Git','px','ETL|ELT','ETL / ELT','RBAC','API','APIs','CI/CD','GitLab(?:\\s*CI/CD)?',
 'Linux','Playwright','WebP','PDF','YOLO','ML|DL','ML / DL','AI','ERP','UAT','RTL','LTR','MG','CV','HR',
 'GitHub','LinkedIn','WhatsApp','Gmail','Google','Supabase','Gemini','Resend','Turnstile',
 'EJAD(?:\\s+(?:EGHR|Digital\\s+Solutions(?:\\s+co)?))?','EjadTech','EGHR','DOTec(?:\\s+Engineering)?',
 'Margins(?:\\s+Developments)?','Sunbelt(?:\\s+Deals)?','BlueDez(?:\\s+Engineered\\s+Solutions)?',
 'DEPI','ExploreAI(?:\\s+Academy)?','CognoRise(?:\\s+InfoTech)?','Computing\\s+Gate\\s+IT',
 'Professional\\s+Corp\\.?','Silver\\s+Partner','Enterprise','Mohamed\\s+Gamal','English','Engineering\\s+Insights',
 'GMT\\+2','USD','MEWA','Najran',
].join('|') + ')$');

function isEnglishish(txt){
  const t = txt.trim();
  if (!t) return false;
  if (/[؀-ۿ]/.test(t)) return false;              // contains Arabic → fine
  if (!/[A-Za-z]/.test(t)) return false;                     // digits/punctuation only
  if (ALLOW.test(t)) return false;                           // allow-listed term
  // allow short Latin token runs that are all allow-listed (e.g. "Python · PostgreSQL · Odoo")
  const parts = t.split(/\s*(?:[·,|/–—]|&|-)\s*/).map(x=>x.trim()).filter(Boolean);
  if (parts.length > 1 && parts.every(x => ALLOW.test(x) || !/[A-Za-z]/.test(x))) return false;
  return true;
}

const b=await chromium.launch();
let total=0, bad=[];
for(const [pn,pu] of [['home','/'],['eghr','/projects/eghr.html'],['request','/request.html']]){
  const ctx=await b.newContext({viewport:{width:1440,height:1000}});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
  ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
  await ctx.addInitScript(()=>{try{localStorage.setItem('mg-lang','ar')}catch(e){}});
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8777'+pu,{waitUntil:'load'});
  await p.evaluate(()=>document.querySelectorAll('.fade-up,.reveal,.cs-reveal,.reveal-scale,.reveal-left').forEach(e=>e.classList.add('visible')));
  await p.waitForTimeout(1800);
  const texts=await p.evaluate(()=>{
    const out=[];
    const walk=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while((n=walk.nextNode())){
      const t=(n.textContent||'').trim();
      if(t.length<2) continue;
      const el=n.parentElement;
      if(!el) continue;
      if(el.closest('script,style,svg,#mobile-menu,.modal-overlay,[hidden],[aria-hidden="true"]')) continue;
      // skip deliberately-LTR islands (email, phone, code, versions)
      if(el.closest('[dir="ltr"]')) continue;
      if(el.closest('[data-lang-btn]')) continue;            // the switch itself
      const cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) continue;
      out.push({t, sel: el.tagName+'.'+(el.className?.toString?.().split(' ')[0]||'')});
    }
    return out;
  });
  texts.forEach(x=>{ total++; if(isEnglishish(x.t)) bad.push(`${pn}  ${x.sel}  "${x.t.slice(0,72)}"`); });
  await ctx.close();
}
await b.close();
console.log(`Arabic UI text nodes scanned: ${total}`);
console.log(`untranslated English strings : ${bad.length}`);
[...new Set(bad)].slice(0,40).forEach(x=>console.log('   ',x));
