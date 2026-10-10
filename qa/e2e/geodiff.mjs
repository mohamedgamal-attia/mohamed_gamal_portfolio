import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');
const b=await chromium.launch();
async function geo(port,pu,w){
  const ctx=await b.newContext({viewport:{width:w,height:900},...(w<=430?{isMobile:true,hasTouch:true}:{})});
  ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
  ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
  await ctx.addInitScript(()=>{try{localStorage.setItem('mg-lang','en')}catch(e){}});
  const p=await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}${pu}`,{waitUntil:'load'});
  // The project/company cards are built from JSON, so wait for them to land
  // before forcing reveal state - otherwise a card measured mid-animation
  // still carries its translateY and reads as a layout shift.
  await p.waitForFunction(()=>{const g=document.querySelector('.projects-grid');return !g||g.children.length>0;},null,{timeout:5000}).catch(()=>{});
  await p.waitForTimeout(500);
  await p.evaluate(()=>document.querySelectorAll('.fade-up,.reveal,.cs-reveal,.reveal-scale,.reveal-left').forEach(e=>e.classList.add('visible')));
  await p.waitForTimeout(1200);
  const g=await p.evaluate(()=>{
    const out={};
    document.querySelectorAll('[id],section,.project-card,.flow-step,.arch-layer,.hv-chip,.hv-plate,.hv-bracket,.xd-facts,.contact-rows a,#back-top,.card-badge,.card-source,.sec-head').forEach((el,i)=>{
      const r=el.getBoundingClientRect(); if(r.width<1&&r.height<1) return;
      const k=(el.id?'#'+el.id:el.tagName+'.'+(typeof el.className==='string'?el.className.trim().split(/\s+/).slice(0,2).join('.'):''))+'#'+i;
      out[k]=[Math.round(r.left),Math.round(r.top+window.scrollY),Math.round(r.width),Math.round(r.height)];
    });
    return {g:out,h:Math.round(document.documentElement.scrollHeight)};
  });
  await ctx.close(); return g;
}
for(const pu of ['/','/projects/eghr.html']) for(const w of [390,1440]){
  const A=await geo(8788,pu,w), B=await geo(8777,pu,w);
  const keys=new Set([...Object.keys(A.g),...Object.keys(B.g)]);
  const moved=[];
  for(const k of keys){ const a=A.g[k],c=B.g[k];
    if(!a||!c){ moved.push(`${k} ${!a?'ADDED':'REMOVED'}`); continue; }
    if(a.some((v,i)=>Math.abs(v-c[i])>2)) moved.push(`${k} ${a.join(',')} -> ${c.join(',')}`);
  }
  console.log(`\n### ${pu} @${w}  pageHeight ${A.h} -> ${B.h}   changed boxes: ${moved.length}/${keys.size}`);
  moved.slice(0,14).forEach(m=>console.log('   ',m));
}
await b.close();
