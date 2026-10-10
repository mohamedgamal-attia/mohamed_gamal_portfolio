import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
const b=await chromium.launch();
let pass=0, fail=0;
const t=(ok,l,x='')=>{ ok?pass++:fail++; console.log((ok?'  PASS ':'  FAIL ')+l+(x?'  '+x:'')); };

const ctx=await b.newContext({viewport:{width:1440,height:900}});
const p=await ctx.newPage();
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,110));});
await p.goto('http://127.0.0.1:8777/',{waitUntil:'load'});
await p.waitForTimeout(900);

console.log('--- default (English) ---');
t(await p.getAttribute('html','lang')==='en','html lang=en');
t(await p.getAttribute('html','dir')==='ltr','html dir=ltr');
t((await p.textContent('.nav-links a[data-section="work"]')).trim()==='Work','nav reads English');
t(await p.locator('.nav-links [data-lang-btn="ar"]').isVisible(),'العربية button visible');
t((await p.textContent('.nav-links [data-lang-btn="ar"]')).trim()==='العربية','button label is العربية (not "Arabic")');

console.log('--- switch to Arabic ---');
await p.click('.nav-links [data-lang-btn="ar"]');
await p.waitForTimeout(600);
t(await p.getAttribute('html','lang')==='ar','html lang=ar');
t(await p.getAttribute('html','dir')==='rtl','html dir=rtl');
const nav=(await p.textContent('.nav-links a[data-section="work"]')).trim();
t(nav==='الأعمال','nav translated', nav);
const h2=(await p.textContent('#work h2')).trim();
t(/[؀-ۿ]/.test(h2),'work heading is Arabic', h2.slice(0,40));
const lead=(await p.textContent('#hero .hero-lead')).trim();
t(/[؀-ۿ]/.test(lead),'hero lead is Arabic');
t((await p.getAttribute('.hero-proof dd[data-i18n="hero.proof.versionsV"]','dir'))==='ltr','Odoo version range stays LTR');

console.log('--- persistence ---');
await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
t(await p.getAttribute('html','lang')==='ar','still Arabic after reload');
t(await p.getAttribute('html','dir')==='rtl','still RTL after reload');

console.log('--- back to English ---');
await p.click('.nav-links [data-lang-btn="en"]'); await p.waitForTimeout(500);
t(await p.getAttribute('html','lang')==='en','back to en');
t((await p.textContent('.nav-links a[data-section="work"]')).trim()==='Work','nav back to English');
t(errs.length===0,'no console errors', errs.slice(0,2).join(' | '));
await ctx.close();

console.log('--- browser-language detection (ar-EG, no stored pref) ---');
const ctx2=await b.newContext({viewport:{width:1440,height:900}, locale:'ar-EG'});
const p2=await ctx2.newPage();
await p2.goto('http://127.0.0.1:8777/',{waitUntil:'load'}); await p2.waitForTimeout(800);
t(await p2.getAttribute('html','lang')==='ar','ar-EG browser defaults to Arabic');
await ctx2.close();

const ctx3=await b.newContext({viewport:{width:1440,height:900}, locale:'fr-FR'});
const p3=await ctx3.newPage();
await p3.goto('http://127.0.0.1:8777/',{waitUntil:'load'}); await p3.waitForTimeout(800);
t(await p3.getAttribute('html','lang')==='en','fr-FR browser falls back to English');
await ctx3.close();

await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
