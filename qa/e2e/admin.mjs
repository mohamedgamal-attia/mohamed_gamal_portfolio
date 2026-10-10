import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
let pass=0, fail=0;
const ok=(c,m)=>{ c?pass++:fail++; console.log(`  ${c?'PASS':'FAIL'}  ${m}`); };

// A stand-in for @supabase/supabase-js that behaves like the real client for
// the calls admin.js makes. Served in place of the CDN module.
const STUB = `
const LEADS = __LEADS__;
let session = __SESSION__;
let authCb = null;
export function createClient(url, key) {
  globalThis.__sbCalls = { url, key, updates: [], selects: 0 };
  return {
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => { authCb = cb; return { data: { subscription: { unsubscribe(){} } } }; },
      signInWithPassword: async ({ email, password }) => {
        if (password === 'correct') {
          session = { access_token: 'tok', user: { id: 'u1', email } };
          authCb && authCb('SIGNED_IN', session);
          return { error: null };
        }
        return { error: { message: 'Invalid login credentials' } };
      },
      signInWithOtp: async () => ({ error: null }),
      signOut: async () => { session = null; authCb && authCb('SIGNED_OUT', null); return { error: null }; },
    },
    from(table) {
      globalThis.__sbCalls.table = table;
      const api = {
        _fields: null, _id: null,
        select() { globalThis.__sbCalls.selects++; return api; },
        order() { return api; },
        limit() { return Promise.resolve({ data: LEADS, error: null }); },
        update(f) { api._fields = f; return api; },
        eq(_c, v) { api._id = v; return api; },
        then(res) {
          globalThis.__sbCalls.updates.push({ id: api._id, fields: api._fields });
          const row = Object.assign({}, LEADS.find(l => l.id === api._id), api._fields);
          return Promise.resolve({ data: [row], error: null }).then(res);
        },
      };
      return api;
    },
  };
}
`;

const LEADS = [
  { id:'11111111-1111-1111-1111-111111111111', reference:'MG-AAA111', created_at:'2026-10-08T09:12:00Z',
    full_name:'Jane Doe', email:'jane@example.com', phone:'+201001234567',
    country_code:'EG', country_name:'Egypt', preferred_language:'en',
    project_type:'simple_website', description:'A clinic website with a booking form.',
    desired_timeline:'two months', client_budget:'around $800', reference_url:null,
    status:'quoted', pricing_tier:'C', complexity:'standard',
    pricing_floor_usd:200, pricing_ceiling_usd:700,
    ai_model:'gemini-2.5-flash', ai_summary:'Clinic site', ai_price_min_usd:300, ai_price_max_usd:525,
    ai_timeline:'2-3 weeks', ai_response_text:'Thanks for getting in touch.', ai_was_clamped:false,
    email_notification_status:'sent', last_notified_at:'2026-10-08T09:12:30Z', admin_notes:null },
  { id:'22222222-2222-2222-2222-222222222222', reference:'MG-BBB222', created_at:'2026-10-09T15:40:00Z',
    full_name:'أحمد محمود', email:'ahmed@example.com', phone:'+966500000000',
    country_code:'SA', country_name:'Saudi Arabia', preferred_language:'ar',
    project_type:'erp_business_system', description:'نظام ERP للمخزون والمحاسبة.',
    desired_timeline:null, client_budget:null, reference_url:null,
    status:'new', pricing_tier:'A', complexity:'advanced',
    pricing_floor_usd:1150, pricing_ceiling_usd:5000,
    ai_model:null, ai_price_min_usd:null, ai_price_max_usd:null, ai_timeline:null,
    ai_response_text:null, ai_was_clamped:false,
    email_notification_status:'failed', last_notified_at:null, admin_notes:null },
  { id:'33333333-3333-3333-3333-333333333333', reference:'MG-CCC333', created_at:'2026-09-30T11:00:00Z',
    full_name:'=cmd|calc', email:'spam@example.com', phone:'+10000000000',
    country_code:'US', country_name:'United States', preferred_language:'en',
    project_type:'other', description:'<img src=x onerror=alert(1)> please build',
    desired_timeline:null, client_budget:null, reference_url:null,
    status:'spam', pricing_tier:'A', complexity:'simple',
    pricing_floor_usd:300, pricing_ceiling_usd:2500,
    ai_model:null, ai_price_min_usd:null, ai_price_max_usd:null, ai_timeline:null,
    ai_response_text:null, ai_was_clamped:false,
    email_notification_status:'pending', last_notified_at:null, admin_notes:null },
];

const b=await chromium.launch();
async function open({ signedIn, configured = true }) {
  const ctx=await b.newContext({viewport:{width:1400,height:1000}, permissions:['clipboard-write']});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  ctx.route('**cdn.jsdelivr.net/npm/@supabase/**', r => r.fulfill({
    contentType:'application/javascript',
    body: STUB.replace('__LEADS__', JSON.stringify(LEADS))
              .replace('__SESSION__', signedIn ? JSON.stringify({access_token:'tok',user:{id:'u1',email:'admin@example.test'}}) : 'null'),
  }));
  if (configured) {
    await ctx.addInitScript(() => {
      // config.js runs later and would overwrite window.Portfolio, so patch it
      // the moment it is defined.
      let v;
      Object.defineProperty(window, 'Portfolio', {
        configurable: true,
        get: () => v,
        set: (x) => { v = x; if (x && x.leadSystem) {
          x.leadSystem.supabaseUrl='https://stub.supabase.test';
          x.leadSystem.supabaseAnonKey='anon-public-key';
          x.leadSystem.resendEndpoint='https://stub.test/resend'; } },
      });
    });
  }
  const errors=[];
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('pageerror: '+e.message));
  await p.goto('http://127.0.0.1:8777/admin.html',{waitUntil:'load'});
  await p.waitForTimeout(600);
  return { ctx, p, errors };
}

console.log('\n--- Not configured ---');
{
  const { ctx, p } = await open({ signedIn:false, configured:false });
  ok(await p.isVisible('#ad-auth'), 'shows the sign-in view');
  ok((await p.textContent('#ad-auth-err')).includes('not connected'), 'says it is not connected rather than failing silently');
  ok(await p.isDisabled('#ad-signin'), 'sign-in is disabled while unconfigured');
  await ctx.close();
}

console.log('\n--- Signed out ---');
{
  const { ctx, p, errors } = await open({ signedIn:false });
  ok(await p.isVisible('#ad-auth'), 'sign-in shown');
  ok(await p.isHidden('#ad-shell'), 'dashboard not rendered at all when signed out');
  ok((await p.content()).indexOf('Jane Doe') === -1, 'no lead data in the DOM when signed out');
  await p.fill('#ad-email','admin@example.test');
  await p.fill('#ad-password','wrong');
  await p.click('#ad-signin');
  await p.waitForTimeout(250);
  ok(!(await p.isHidden('#ad-auth-err')), 'a wrong password is reported');
  ok(await p.isHidden('#ad-shell'), 'still signed out after a failed attempt');
  await p.fill('#ad-password','correct');
  await p.click('#ad-signin');
  await p.waitForSelector('#ad-shell:not([hidden])',{timeout:3000});
  ok(true, 'correct password signs in');
  ok(errors.length===0, 'no console errors ('+errors.join(' | ')+')');
  await ctx.close();
}

console.log('\n--- Dashboard ---');
{
  const { ctx, p, errors } = await open({ signedIn:true });
  await p.waitForSelector('#ad-shell:not([hidden])');
  ok((await p.textContent('#ad-who')).includes('admin@example.test'), 'shows who is signed in');
  ok((await p.$$('#ad-rows tr')).length===3, 'all three leads listed');
  const stats=await p.$$eval('.ad-stat', ns=>ns.map(n=>n.textContent.trim()));
  ok(stats[0].includes('Total') && stats[0].includes('3'), 'total counted');
  ok(stats.some(s=>s.includes('New')&&s.includes('1')), 'new counted');

  // XSS: a lead whose description contains markup must render as text.
  ok((await p.$$('#ad-rows img')).length===0, 'no element injected from lead content');

  // Search
  await p.fill('#ad-q','ahmed');
  await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===1, 'search by email narrows the list');
  await p.fill('#ad-q','+9665');
  await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===1, 'search by phone works');
  await p.fill('#ad-q','');

  // Filters
  await p.selectOption('#ad-status','spam');
  await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===1, 'status filter works');
  await p.click('#ad-clear');
  await p.waitForTimeout(150);
  await p.selectOption('#ad-lang','ar');
  await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===1, 'language filter works');
  await p.click('#ad-clear'); await p.waitForTimeout(150);
  await p.fill('#ad-from','2026-10-09');
  await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===1, 'date-from filter works');
  await p.click('#ad-clear'); await p.waitForTimeout(150);
  ok((await p.$$('#ad-rows tr')).length===3, 'clear restores every row');

  // Detail
  await p.click('#ad-rows tr:nth-child(1)');
  await p.waitForSelector('#ad-drawer:not([hidden])');
  const body=await p.textContent('#ad-d-body');
  ok(body.includes('jane@example.com'), 'detail shows the client email');
  ok(body.includes('$300') && body.includes('$525'), 'detail shows the quote');
  ok(body.includes('$200') && body.includes('$700'), 'detail shows the allowed window for audit');
  ok(body.includes('gemini-2.5-flash'), 'detail shows which model answered');
  const waHref=await p.getAttribute('#ad-d-body a[href^="https://wa.me/"]','href');
  ok(waHref==='https://wa.me/201001234567', 'WhatsApp deep link built from the stored phone');

  // Status change
  await p.selectOption('#ad-d-body select','contacted');
  await p.waitForTimeout(250);
  const calls=await p.evaluate(()=>globalThis.__sbCalls);
  ok(calls.updates.length===1 && calls.updates[0].fields.status==='contacted', 'status change issues one update');
  ok(calls.updates[0].id==='11111111-1111-1111-1111-111111111111', 'update targets the right row');

  // Note
  await p.fill('#ad-d-body textarea','Called, wants a demo.');
  await p.click('#ad-d-body button:has-text("Save note")');
  await p.waitForTimeout(250);
  const calls2=await p.evaluate(()=>globalThis.__sbCalls);
  ok(calls2.updates.some(u=>u.fields.admin_notes==='Called, wants a demo.'), 'note saved');

  // Esc closes
  await p.keyboard.press('Escape');
  await p.waitForTimeout(150);
  ok(await p.isHidden('#ad-drawer'), 'Escape closes the detail drawer');

  ok(errors.length===0, 'no console errors ('+errors.join(' | ')+')');
  await ctx.close();
}

console.log('\n--- CSV safety ---');
{
  const { ctx, p } = await open({ signedIn:true });
  await p.waitForSelector('#ad-shell:not([hidden])');
  const csv = await p.evaluate(() => {
    let captured = null;
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => { captured = blob; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () {};
    document.getElementById('ad-export').click();
    URL.createObjectURL = realCreate;
    return captured.text();
  });
  ok(csv.includes('reference,created_at'), 'CSV has a header row');
  ok(csv.includes("'=cmd|calc"), 'a formula-looking name is neutralised with a leading quote');
  ok(csv.startsWith('﻿') || csv.includes('أحمد'), 'Arabic survives the export');
  await ctx.close();
}

// Screenshots for visual review
{
  const { ctx, p } = await open({ signedIn:true });
  await p.waitForSelector('#ad-shell:not([hidden])');
  await p.waitForTimeout(400);
  await p.screenshot({path:'out/admin-list.png'});
  await p.click('#ad-rows tr:nth-child(1)');
  await p.waitForSelector('#ad-drawer:not([hidden])');
  await p.waitForTimeout(300);
  await p.screenshot({path:'out/admin-detail.png'});
  await ctx.close();
}
{
  const { ctx, p } = await open({ signedIn:false });
  await p.waitForTimeout(300);
  await p.screenshot({path:'out/admin-login.png'});
  await ctx.close();
}

await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
