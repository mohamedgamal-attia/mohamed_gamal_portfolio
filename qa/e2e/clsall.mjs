import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg; import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');
const b=await chromium.launch();
for (const [name,url] of [['home','/'],['eghr','/projects/eghr.html'],['request','/request.html']]) {
  for (const w of [1440, 390]) {
    const ctx=await b.newContext({viewport:{width:w,height:900},...(w<=430?{isMobile:true,hasTouch:true}:{})});
    ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
    ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
    const p=await ctx.newPage();
    await p.addInitScript(()=>{ window.__cls=0;
      new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true}); });
    await p.goto('http://127.0.0.1:8777'+url,{waitUntil:'load'});
    await p.waitForTimeout(2200);
    const cls=await p.evaluate(()=>window.__cls);
    console.log(`${name.padEnd(8)} @${String(w).padEnd(5)} CLS ${cls.toFixed(4)}`);
    await ctx.close();
  }
}
await b.close();
