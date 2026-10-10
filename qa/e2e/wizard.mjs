import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');
const ENDPOINT='https://mock.estimate.test/project-estimate';

let pass=0, fail=0;
const ok=(c,m)=>{ c?pass++:fail++; console.log(`  ${c?'PASS':'FAIL'}  ${m}`); };

const b=await chromium.launch();
async function newPage(lang, {capture}={}) {
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
  ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
  if (lang) await ctx.addInitScript(l=>{try{localStorage.setItem('mg-lang',l)}catch(e){}}, lang);
  const errors=[];
  const seen=[];
  await ctx.route(ENDPOINT, async route => {
    const body = JSON.parse(route.request().postData()||'{}');
    seen.push(body);
    if (capture && capture.reply) return route.fulfill(capture.reply(body));
    route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({
      ok:true, reference:'MG-7K4P2Q', aiAvailable:true, notified:true,
      quote:{ language: body.language, projectType: body.projectType,
        summary: body.language==='ar' ? 'موقع عيادة بسيط مع نموذج حجز.' : 'A small clinic website with a booking form.',
        recommendedScope: body.language==='ar' ? ['الصفحات والمحتوى','نموذج الحجز','الإطلاق'] : ['Pages and content','Booking form','Launch'],
        priceMinUsd:300, priceMaxUsd:525,
        estimatedTimeline: body.language==='ar' ? '2–3 أسابيع' : '2–3 weeks',
        assumptions: body.language==='ar' ? ['المحتوى من العميل'] : ['Content supplied by the client'],
        customerMessage: body.language==='ar' ? 'شكرًا لتواصلك. هذا نطاق مبدئي بناءً على ما وصفته.' : 'Thanks for getting in touch. Here is a preliminary range based on what you described.',
        meetingCta: body.language==='ar' ? 'احجز اجتماعًا' : 'Book a meeting',
        disclaimer: body.language==='ar' ? 'هذا تقدير مبدئي تقريبي، وقد يزيد أو يقل بعد اجتماع قصير لفهم المتطلبات بشكل أدق.' : 'This is an initial approximate estimate and may increase or decrease after a short requirements meeting.' } }) });
  });
  const p=await ctx.newPage();
  p.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
  p.on('pageerror',e=>errors.push('pageerror: '+e.message));
  await p.goto('http://127.0.0.1:8777/request.html',{waitUntil:'load'});
  await p.evaluate(e=>{ window.Portfolio.leadSystem.endpoint = e; }, ENDPOINT);
  await p.waitForFunction(()=>document.querySelectorAll('#rq-country option').length>50, null, {timeout:5000});
  return { ctx, p, errors, seen };
}

async function fillAll(p, { lang='en', country='EG', desc=null, consent=true } = {}) {
  await p.fill('#rq-name', lang==='ar' ? 'جين دو' : 'Jane Doe');
  await p.fill('#rq-email','jane@example.com');
  await p.fill('#rq-phone','+20 100 123 4567');
  await p.selectOption('#rq-country', country);
  await p.click('[data-next="2"]');
  await p.selectOption('#rq-type','simple_website');
  await p.click('[data-next="3"]');
  await p.fill('#rq-desc', desc ?? (lang==='ar'
    ? 'أحتاج موقعًا صغيرًا لعيادتي مع نموذج حجز وصفحة عن العيادة.'
    : 'A small website for my clinic with a booking form and an about page.'));
  if (consent) await p.check('#rq-consent');
}

/* ── English ─────────────────────────────────────────────────── */
console.log('\n--- English flow ---');
{
  const { ctx, p, errors, seen } = await newPage('en');
  ok(await p.getAttribute('html','lang')==='en', 'html lang=en');
  ok(await p.getAttribute('html','dir')==='ltr', 'html dir=ltr');
  ok(await p.isVisible('[data-panel="1"]') && !(await p.isVisible('[data-panel="2"]')), 'starts on step 1');
  ok((await p.textContent('#rq-h1')).includes('reach you'), 'step 1 asks for contact details FIRST');

  // Blocked without valid step-1 fields
  await p.click('[data-next="2"]');
  ok(await p.isVisible('[data-panel="1"]'), 'cannot leave step 1 while it is empty');
  ok((await p.textContent('[data-err-for="fullName"]')).length>0, 'name error shown');

  await fillAll(p,{lang:'en'});
  ok(await p.isVisible('[data-panel="3"]'), 'reached step 3');

  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])',{timeout:5000});
  ok(seen.length===1, 'exactly one request sent');
  ok(seen[0].countryName==='Egypt', 'country name sent in English regardless of UI language');
  ok(seen[0].consent===true, 'consent sent');
  ok(seen[0].company==='', 'honeypot sent empty');
  ok((await p.textContent('#rq-price')).includes('$300'), 'price rendered');
  ok((await p.textContent('#rq-reference'))==='MG-7K4P2Q', 'reference rendered');
  ok((await p.$$('#rq-scope li')).length===3, 'scope list rendered');
  ok(await p.isHidden('#rq-form'), 'form hidden after success');
  const wa=await p.getAttribute('#rq-whatsapp','href');
  ok(wa && wa.includes('wa.me/201102672347'), 'WhatsApp link reuses the site number');
  ok(wa && decodeURIComponent(wa).includes('MG-7K4P2Q'), 'WhatsApp message carries the reference');
  ok(wa && decodeURIComponent(wa).includes('300'), 'WhatsApp message carries the estimate');
  ok(await p.isVisible('#rq-notified'), 'delivery claimed only because backend confirmed it');
  ok(errors.length===0, 'no console errors ('+errors.join('|')+')');
  await ctx.close();
}

/* ── Arabic ──────────────────────────────────────────────────── */
console.log('\n--- Arabic flow ---');
{
  const { ctx, p, errors, seen } = await newPage('ar');
  ok(await p.getAttribute('html','lang')==='ar', 'html lang=ar');
  ok(await p.getAttribute('html','dir')==='rtl', 'html dir=rtl');
  ok((await p.textContent('#rq-h1')).trim().startsWith('كيف'), 'step 1 heading is Arabic');
  const ph=await p.getAttribute('#rq-name','placeholder');
  ok(/[؀-ۿ]/.test(ph), 'placeholders translated');
  const opt=await p.textContent('#rq-country option[value="EG"]');
  ok(opt.trim()==='مصر', 'country names in Arabic ('+opt.trim()+')');

  await fillAll(p,{lang:'ar'});
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])',{timeout:5000});
  ok(seen[0].language==='ar', 'language sent as ar');
  ok(seen[0].countryName==='Egypt', 'country name still English in the record');
  ok(/[؀-ۿ]/.test(await p.textContent('#rq-summary')), 'summary in Arabic');
  const price=await p.textContent('#rq-price');
  ok(price.includes('$300'), 'price stays Western/LTR: '+price.trim());
  ok(await p.getAttribute('#rq-price','dir')==='ltr', 'price is an LTR island');
  const wa=decodeURIComponent(await p.getAttribute('#rq-whatsapp','href'));
  ok(/[؀-ۿ]/.test(wa), 'WhatsApp prefill is Arabic');
  ok(errors.length===0, 'no console errors ('+errors.join('|')+')');
  await ctx.close();
}

/* ── Failure paths ───────────────────────────────────────────── */
console.log('\n--- Failure paths ---');
{
  const { ctx, p } = await newPage('en', { capture: { reply: () => ({
    status:200, contentType:'application/json',
    body: JSON.stringify({ ok:true, reference:'MG-AAA111', aiAvailable:false, notified:true,
      message:'Your request has been received and sent to Mohamed. The automatic estimate is temporarily unavailable, so he will reply with a quote personally.' }) }) } });
  await fillAll(p,{lang:'en'});
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-result:not([hidden])',{timeout:5000});
  ok((await p.textContent('#rq-summary')).includes('sent to Mohamed'), 'AI-failed fallback is honest about what happened');
  ok(await p.isHidden('.rq-result-grid'), 'no empty price block when there is no quote');
  ok((await p.textContent('#rq-reference'))==='MG-AAA111', 'reference still shown');
  await ctx.close();
}
{
  const { ctx, p } = await newPage('en', { capture: { reply: () => ({
    status:400, contentType:'application/json',
    body: JSON.stringify({ ok:false, code:'validation', message:'Some details need a second look.',
      errors:[{field:'email',code:'invalid'}] }) }) } });
  await fillAll(p,{lang:'en'});
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])',{timeout:5000});
  ok((await p.textContent('[data-err-for="email"]')).length>0, 'server field errors are shown on the field');
  ok(await p.isHidden('#rq-result'), 'no result panel on a rejected submission');
  await ctx.close();
}
{
  const { ctx, p } = await newPage('en', { capture: { reply: () => ({ status:500, body:'' }) } });
  await fillAll(p,{lang:'en'});
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])',{timeout:6000});
  const msg=await p.textContent('#rq-form-err');
  ok(msg.length>0 && !/500|undefined|\[object/i.test(msg), 'a broken response gives a human message: '+JSON.stringify(msg.trim().slice(0,60)));
  ok(!(await p.isVisible('.is-submitting')), 'the submit button is released again');
  await ctx.close();
}

/* ── Draft, persistence, honeypot ────────────────────────────── */
console.log('\n--- Draft / persistence / honeypot ---');
{
  const { ctx, p } = await newPage('en');
  await p.fill('#rq-name','Jane Doe');
  await p.fill('#rq-email','jane@example.com');
  await p.fill('#rq-phone','+20 100 123 4567');
  await p.selectOption('#rq-country','EG');
  await p.click('[data-next="2"]');
  await p.waitForTimeout(150);
  await p.reload({waitUntil:'load'});
  await p.waitForFunction(()=>document.querySelectorAll('#rq-country option').length>50);
  await p.waitForTimeout(250);
  ok(await p.inputValue('#rq-name')==='Jane Doe', 'typed name survives a reload');
  ok(await p.inputValue('#rq-country')==='EG', 'country survives a reload');
  ok(await p.isVisible('[data-panel="2"]'), 'returns to the step that was reached');
  await ctx.close();
}
{
  const { ctx, p } = await newPage('en');
  const hp = await p.$('#rq-company');
  ok(hp !== null, 'honeypot field exists');
  const box = await p.evaluate(() => {
    const el = document.getElementById('rq-company');
    // The WRAPPER is what clips; the input's own layout box overflows it and
    // is hidden by overflow + clip-path. Verified visually: with both removed
    // the field appears in the same crop, with them it does not.
    const wrap = el.closest('.rq-hp');
    const r = wrap.getBoundingClientRect();
    const cs = getComputedStyle(wrap);
    return { w: r.width, h: r.height, clip: cs.clipPath, overflow: cs.overflow,
             ariaHidden: el.closest('[aria-hidden]')?.getAttribute('aria-hidden') };
  });
  ok(box.w <= 1 && box.h <= 1 && box.clip !== 'none' && box.overflow === 'hidden',
     `honeypot is clipped to nothing (${box.w}x${box.h}, ${box.clip}, overflow:${box.overflow})`);
  ok(box.ariaHidden === 'true', 'honeypot is hidden from assistive technology');
  ok(await p.getAttribute('#rq-company','tabindex')==='-1', 'honeypot is out of the tab order');
  await ctx.close();
}
{
  // Language switch mid-form must keep what was typed.
  const { ctx, p } = await newPage('en');
  await p.fill('#rq-name','Jane Doe');
  await p.fill('#rq-email','jane@example.com');
  await p.click('[data-lang-btn="ar"]');
  await p.waitForFunction(()=>document.documentElement.getAttribute('dir')==='rtl');
  await p.waitForTimeout(200);
  ok(await p.inputValue('#rq-name')==='Jane Doe', 'switching language does not clear the form');
  ok((await p.textContent('#rq-country option[value="EG"]')).trim()==='مصر', 'country list re-renders in Arabic');
  await ctx.close();
}
{
  // Not configured -> say so, do not pretend.
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:GF}));
  ctx.route('**://fonts.gstatic.com/**',r=>r.abort());
  const p=await ctx.newPage();
  await p.goto('http://127.0.0.1:8777/request.html',{waitUntil:'load'});
  await p.waitForFunction(()=>document.querySelectorAll('#rq-country option').length>50);
  await fillAll(p,{lang:'en'});
  await p.click('#rq-submit');
  await p.waitForSelector('#rq-form-err:not([hidden])',{timeout:4000});
  ok((await p.textContent('#rq-form-err')).includes('not connected'), 'unconfigured endpoint is stated plainly, not faked');
  await ctx.close();
}

await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
