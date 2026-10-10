import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');
// [page, selector, css prop, expected-in-EN, expected-in-AR]
const CASES=[
 ['/', '#back-top','right','26px','auto'], ['/', '#back-top','left','auto','26px'],
 ['/', '.hv-chip','right','-34px','271.531px'], ['/', '.hv-chip','left','271.547px','-34px'],
 ['/', '.flow-step','border-right-width','1px','0px'],
 ['/', '.flow-step','border-left-width','0px','1px'],
 ['/', '.xd-facts dd','text-align','end','end'],
 ['/projects/eghr.html','.arch-layer','border-left-width','3px','1px'],
 ['/projects/eghr.html','.arch-layer','border-right-width','1px','3px'],
 ['/projects/eghr.html','.lb-prev','left','18px','auto'],
 ['/projects/eghr.html','.lb-prev','right','auto','18px'],
];
const b=await chromium.launch(); let pass=0,fail=0;
for(const lang of ['en','ar']){
 const byPage={}; CASES.forEach(c=>{(byPage[c[0]]=byPage[c[0]]||[]).push(c);});
 for(const [pu,cases] of Object.entries(byPage)){
  const ctx=await b.newContext({viewport:{width:1440,height:900}});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
  ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
  await ctx.addInitScript(l=>{try{localStorage.setItem('mg-lang',l)}catch(e){}}, lang);
  const p=await ctx.newPage(); await p.goto('http://127.0.0.1:8777'+pu,{waitUntil:'load'}); await p.waitForTimeout(400);
  for(const [,sel,prop,en,ar] of cases){
    const got=await p.evaluate(([s,pr])=>{const e=document.querySelector(s);return e?getComputedStyle(e)[pr]:'MISSING';},[sel,prop]);
    const want=lang==='en'?en:ar;
    const ok=got===want; ok?pass++:fail++;
    console.log(`${ok?'PASS':'FAIL'} [${lang}] ${sel} { ${prop} } = ${got}${ok?'':'  (expected '+want+')'}`);
  }
  await ctx.close();
 }
}
await b.close();
console.log(`\n=== ${pass} passed, ${fail} failed ===`);
