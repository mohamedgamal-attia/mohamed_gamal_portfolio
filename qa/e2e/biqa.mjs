import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');
const VPS=[360,390,430,768,1024,1366,1440,1920];
const b=await chromium.launch();
let overflow=0, errs=0, overlap=0, det=[];
for(const lang of ['en','ar']){
 for(const [pn,pu] of [['home','/'],['eghr','/projects/eghr.html'],['request','/request.html']]){
  for(const w of VPS){
    const ctx=await b.newContext({viewport:{width:w,height:900},...(w<=430?{isMobile:true,hasTouch:true}:{})});
    ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
    ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
    await ctx.addInitScript(l=>{try{localStorage.setItem('mg-lang',l)}catch(e){}}, lang);
    const p=await ctx.newPage();
    p.on('console',m=>{if(m.type()==='error'){errs++;det.push(`${lang} ${pn}@${w} CONSOLE ${m.text().slice(0,90)}`);}});
    await p.goto('http://127.0.0.1:8777'+pu,{waitUntil:'load'});
    // The project/company cards are built from JSON, so wait for them to land
  // before forcing reveal state - otherwise a card measured mid-animation
  // still carries its translateY and reads as a layout shift.
  await p.waitForFunction(()=>{const g=document.querySelector('.projects-grid');return !g||g.children.length>0;},null,{timeout:5000}).catch(()=>{});
  await p.waitForTimeout(500);
  await p.evaluate(()=>document.querySelectorAll('.fade-up,.reveal,.cs-reveal,.reveal-scale,.reveal-left').forEach(e=>e.classList.add('visible')));
    await p.waitForTimeout(900);
    const ov=await p.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-window.innerWidth));
    if(ov>1){overflow++;det.push(`${lang} ${pn}@${w} H-OVERFLOW ${ov}px`);}
    const bad=await p.evaluate(()=>{
      const out=[];
      const t=[...document.querySelectorAll('h1,h2,h3,h4,p,span,a,li,dt,dd,button,figcaption')].filter(el=>{
        const s=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
        if(s.length<3) return false;
        const cs=getComputedStyle(el);
        if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) return false;
        if(cs.position==='absolute'||cs.position==='fixed') return false;
        for(let n=el;n&&n!==document.body;n=n.parentElement) if(+getComputedStyle(n).opacity===0) return false;
        const r=el.getBoundingClientRect(); return r.width>2&&r.height>2;});
      t.forEach(el=>{const cs=getComputedStyle(el);
        const hid=cs.overflow==='hidden'||cs.overflowX==='hidden'||cs.overflowY==='hidden';
        if(hid&&el.scrollWidth>el.clientWidth+2&&cs.textOverflow!=='ellipsis')
          out.push('clip-x '+el.tagName+' '+el.textContent.trim().slice(0,24));
        if(hid&&el.scrollHeight>el.clientHeight+3)
          out.push('clip-y '+el.tagName+' '+el.textContent.trim().slice(0,24));});
      const by=new Map();
      for(const el of t){ if(!by.has(el.parentElement)) by.set(el.parentElement,[]); by.get(el.parentElement).push(el); }
      for(const sib of by.values()){ if(sib.length<2) continue;
        const rc=sib.map(e=>e.getBoundingClientRect());
        // An inline element that wraps over several lines has a UNION bounding
        // box covering the whole paragraph, which legitimately overlaps its
        // inline siblings. Compare the per-line fragments instead.
        const frags=sib.map(e=>[...e.getClientRects()].filter(r=>r.width>2&&r.height>2));
        for(let i=0;i<sib.length;i++) for(let j=i+1;j<sib.length;j++){
          if(sib[i].contains(sib[j])||sib[j].contains(sib[i])) continue;
          const a=rc[i],c=rc[j];
          if(!(Math.min(a.right,c.right)-Math.max(a.left,c.left)>6 && Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>6)) continue;
          let hit=false;
          for(const fa of frags[i]){ for(const fc of frags[j]){
            if(Math.min(fa.right,fc.right)-Math.max(fa.left,fc.left)>6 &&
               Math.min(fa.bottom,fc.bottom)-Math.max(fa.top,fc.top)>6){ hit=true; break; } }
            if(hit) break; }
          if(hit) out.push('overlap '+sib[i].tagName+'/'+sib[j].tagName+' '+sib[i].textContent.trim().slice(0,18));
        }}
      return [...new Set(out)];
    });
    if(bad.length){overlap+=bad.length; bad.slice(0,2).forEach(x=>det.push(`${lang} ${pn}@${w} ${x}`));}
    await ctx.close();
  }
 }
 console.log(lang,'done');
}
await b.close();
console.log('\n=== BILINGUAL QA (8 viewports x 3 pages x 2 languages = 48) ===');
console.log('horizontal overflow:', overflow);
console.log('console errors    :', errs);
console.log('text overlap/clip :', overlap);
if(det.length){console.log('--- details ---'); [...new Set(det)].slice(0,20).forEach(d=>console.log('  ',d));}
