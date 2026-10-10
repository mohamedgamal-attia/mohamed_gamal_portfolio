import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs'; import nodePath from 'path';
const DIR='/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const GF=fs.readFileSync(DIR+'vendor/gf.css','utf8'), GF2=fs.readFileSync(DIR+'vendor/gf2.css','utf8');

// Expected range per tier, from the brief's recommended usage table.
const RANGE = {
  'ic-xs':     [11, 14],
  'ic-arrow':  [13, 17],
  'ic-sm':     [13, 17],
  'ic-btn':    [14, 18],
  'ic-md':     [14, 18],
  'ic-social': [17, 21],
  'ic-row':    [17, 23],
  'ic-lg':     [22, 26],
  'ic-feature':[26, 34],
};
const HARD_MAX = 40;   // §31: flag any normal UI icon over 40px

const b=await chromium.launch();
const rows=[]; let fail=0;
for(const [pn,pu] of [['home','/'],['eghr','/projects/eghr.html']]){
  for(const w of [1440,768,390]){
    const ctx=await b.newContext({viewport:{width:w,height:900},...(w<=430?{isMobile:true,hasTouch:true}:{})});
    ctx.route('**://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:r.request().url().includes('Fraunces')?GF2:GF}));
    ctx.route('**://fonts.gstatic.com/**',r=>{const f=DIR+'vendor/gstatic/'+nodePath.basename(new URL(r.request().url()).pathname);fs.existsSync(f)?r.fulfill({body:fs.readFileSync(f)}):r.abort();});
    const p=await ctx.newPage();
    await p.goto('http://127.0.0.1:8777'+pu,{waitUntil:'load'});
    // The project cards are built from JSON, so wait for them FIRST. Forcing
    // reveal state before they exist leaves 40 card icons un-revealed, and an
    // un-revealed icon measures 0x0 and is excluded - a weaker result dressed
    // up as the same "0 out of range".
    await p.waitForFunction(() => {
      const g = document.querySelector('.projects-grid');
      return !g || g.children.length > 0;
    }, null, { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(400);
    await p.evaluate(()=>document.querySelectorAll('.cs-reveal,.fade-up,.reveal,.reveal-scale,.reveal-left').forEach(e=>e.classList.add('visible')));
    await p.waitForTimeout(1300);
    const got=await p.evaluate(()=>[...document.querySelectorAll('svg.ic')].filter(el=>{
      // Only judge icons that are actually rendered. An icon inside a closed
      // modal or the hidden back-to-top button measures 0x0, which is not an
      // icon-size defect.
      const r=el.getBoundingClientRect();
      if(r.width<1 && r.height<1) return false;
      for(let n=el;n&&n!==document.body;n=n.parentElement){
        const cs=getComputedStyle(n);
        if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) return false;
      }
      return true;
    }).map(el=>{
      const r=el.getBoundingClientRect();
      const owner=el.closest('a,button,li,span');
      return {tier:[...el.classList].find(c=>c.startsWith('ic-'))||'(none)',
        w:Math.round(r.width*10)/10, h:Math.round(r.height*10)/10,
        label:(owner?.textContent||'').trim().replace(/\s+/g,' ').slice(0,28),
        href:(el.querySelector('use')?.getAttribute('href')||'').replace('#i-','')};
    }));
    got.forEach(g=>{
      const [lo,hi]=RANGE[g.tier]||[0,HARD_MAX];
      const size=Math.max(g.w,g.h);
      const ok = size>=lo && size<=hi && size<=HARD_MAX;
      if(!ok) fail++;
      rows.push({page:pn,vp:w,...g,size,lo,hi,ok});
    });
    await ctx.close();
  }
}
await b.close();
// Report one line per distinct (tier, icon) pair with its measured range
const key=r=>r.tier+'|'+r.href;
const groups=new Map();
rows.forEach(r=>{ if(!groups.has(key(r))) groups.set(key(r),[]); groups.get(key(r)).push(r); });
console.log('component                         tier         rendered   expected   result');
console.log('-'.repeat(78));
[...groups.entries()].sort().forEach(([k,rs])=>{
  const sizes=[...new Set(rs.map(r=>r.size))].sort((a,b)=>a-b);
  const [tier,href]=k.split('|');
  const bad=rs.filter(r=>!r.ok).length;
  const label=(rs[0].label||href).slice(0,30);
  console.log(`${label.padEnd(33)}${tier.padEnd(13)}${(sizes.join('/')+'px').padEnd(11)}${(rs[0].lo+'-'+rs[0].hi+'px').padEnd(11)}${bad?'FAIL ('+bad+')':'PASS'}`);
});
console.log('-'.repeat(78));
console.log(`${rows.length} RENDERED icon instances measured across 2 pages x 3 viewports`);
console.log('(icons inside closed modals / hidden controls are excluded, not failed)');
console.log(`over ${HARD_MAX}px (hard flag): ${rows.filter(r=>r.size>HARD_MAX).length}`);
console.log(`out of expected range          : ${fail}`);
fs.writeFileSync('/home/user/mohamed_gamal_portfolio/qa/icon_sizes.json', JSON.stringify(rows,null,1));
