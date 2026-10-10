import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
let pass=0, fail=0, productionHits=0;
const ok=(c,m,x='')=>{ c?pass++:fail++; console.log(`  ${c?'PASS':'FAIL'}  ${m}${x?'  '+x:''}`); };
const EP='https://mock.estimate.test/project-estimate';
const b=await chromium.launch();

async function page(lang, route) {
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
  ctx.route('**://fonts.gstatic.com/**',r=>r.abort());
  // Safety net: neither suite has any business calling the production API.
  // If a future edit forgets to route or blank the endpoint, fail here
  // instead of silently creating a real lead.
  await ctx.route('**mogamal.duckdns.org**', (r) => {
    console.log('  FAIL  a test reached the PRODUCTION endpoint: ' + r.request().url());
    productionHits++;
    r.abort();
  });

  await ctx.addInitScript(l=>{try{localStorage.setItem('mg-lang',l)}catch(e){}}, lang);
  if (route) await ctx.route(EP, route);
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8777/request.html',{waitUntil:'load'});
  if (route) await p.evaluate(e=>{window.Portfolio.leadSystem.endpoint=e;}, EP);
  await p.waitForFunction(()=>document.querySelectorAll('#rq-country option').length>5);
  return { ctx, p };
}
async function fill(p, lang) {
  await p.fill('#rq-name', lang==='ar'?'جين':'Jane Doe');
  await p.fill('#rq-email','jane@example.com');
  await p.fill('#rq-phone','+20 100 123 4567');
  await p.selectOption('#rq-country','EG');
  await p.click('[data-next="2"]');
  await p.selectOption('#rq-type','simple_website');
  await p.click('[data-next="3"]');
  await p.fill('#rq-desc', lang==='ar'
    ? 'أحتاج موقعًا صغيرًا لعيادتي مع نموذج حجز وصفحة تعريفية.'
    : 'A small website for my clinic with a booking form and an about page.');
  await p.check('#rq-consent');
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])',{timeout:8000});
}

console.log('\n--- Not configured ---');
for (const lang of ['en','ar']) {
  // config.js now ships a LIVE endpoint, so this block must blank it
  // explicitly. Without that it POSTs real submissions to production.
  const { ctx, p } = await page(lang, null);
  await p.evaluate(() => { window.Portfolio.leadSystem.endpoint = ''; });
  await fill(p, lang);
  const txt = (await p.textContent('#rq-form-err')).trim();
  ok(txt.length>0, `${lang}: a message is shown`, JSON.stringify(txt.slice(0,52)));
  ok(lang==='ar' ? /[؀-ۿ]/.test(txt) : !/[؀-ۿ]/.test(txt),
     `${lang}: message is in the right language`);
  const links = await p.$$eval('#rq-form-err a', ns=>ns.map(n=>n.getAttribute('href')));
  ok(links.some(h=>h && h.startsWith('https://wa.me/')), `${lang}: WhatsApp route offered`, links.join(' '));
  ok(links.some(h=>h && h.startsWith('mailto:')), `${lang}: email route offered`);
  await ctx.close();
}

console.log('\n--- Deployed but failing (5xx) ---');
for (const lang of ['en','ar']) {
  const { ctx, p } = await page(lang, r=>r.fulfill({status:503, contentType:'text/plain', body:'upstream'}));
  await fill(p, lang);
  const txt = (await p.textContent('#rq-form-err')).trim();
  const expected = lang==='ar' ? 'غير متاح مؤقتًا' : 'temporarily unavailable';
  ok(txt.includes(expected), `${lang}: uses the "temporarily unavailable" wording`, JSON.stringify(txt.slice(0,56)));
  ok((await p.$$('#rq-form-err a')).length>=1, `${lang}: contact routes offered on a server failure`);
  await ctx.close();
}

console.log('\n--- 401 from the gateway (wrong/absent anon key) ---');
{
  const { ctx, p } = await page('en', r=>r.fulfill({status:401, contentType:'application/json', body:'{"message":"Missing authorization header"}'}));
  await fill(p, 'en');
  const txt=(await p.textContent('#rq-form-err')).trim();
  ok(/temporarily unavailable/.test(txt), 'a 401 is reported as unavailable, not as a form error', JSON.stringify(txt.slice(0,56)));
  ok(!/401|authorization/i.test(txt), 'the gateway detail is not shown to the visitor');
  await ctx.close();
}

console.log('\n--- A genuine validation rejection still behaves as a form error ---');
{
  const { ctx, p } = await page('en', r=>r.fulfill({status:400, contentType:'application/json',
    body: JSON.stringify({ok:false, code:'validation', message:'Some details need a second look.', errors:[{field:'email',code:'invalid'}]})}));
  await fill(p, 'en');
  const txt=(await p.textContent('#rq-form-err')).trim();
  ok(txt.includes('second look'), 'the server message is used verbatim', JSON.stringify(txt.slice(0,40)));
  ok((await p.$$('#rq-form-err a')).length===0, 'no contact escape hatch on a fixable validation error');
  // textContent reads hidden nodes too, so assert the slot is actually
  // VISIBLE - a server field error that lands in a collapsed step is not
  // "shown" to anyone.
  const slot = await p.$('[data-err-for="email"]');
  ok(await slot.isVisible() && (await slot.textContent()).trim().length > 0,
     'the field error is visible, not buried in a collapsed step');
  await ctx.close();
}

await b.close();
if (productionHits) { fail += productionHits; console.log(`\n  ${productionHits} request(s) escaped to PRODUCTION`); }
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
