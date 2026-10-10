import pkg from '/opt/node-tools/node_modules/playwright/index.js';
const { chromium } = pkg;
import fs from 'fs';
import nodePath from 'path';
const DIR = '/tmp/claude-0/-home-user-mohamed-gamal-portfolio/a61b8e2f-6245-581f-894e-e1cc5171affe/scratchpad/';
const FA  = fs.readFileSync(DIR + 'vendor/package/css/all.min.css', 'utf8');
const GF  = fs.readFileSync(DIR + 'vendor/gf.css', 'utf8');
const GF2 = fs.readFileSync(DIR + 'vendor/gf2.css', 'utf8');
const OUT = process.argv[2] || 'performance.json';

const PAGES = [
  ['homepage',      '/'],
  ['eghr-case',     '/projects/eghr.html'],
  ['request',       '/request.html'],
];
const VIEWPORTS = [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]];

function routes(ctx) {
  ctx.route('**://cdnjs.cloudflare.com/**/all.min.css', r => r.fulfill({ contentType: 'text/css', body: FA }));
  ctx.route('**://cdnjs.cloudflare.com/**/webfonts/*', r => {
    const f = DIR + 'vendor/package/webfonts/' + nodePath.basename(new URL(r.request().url()).pathname);
    fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f) }) : r.abort(); });
  ctx.route('**://fonts.googleapis.com/**', r =>
    r.fulfill({ contentType: 'text/css', body: r.request().url().includes('Fraunces') ? GF2 : GF }));
  ctx.route('**://fonts.gstatic.com/**', r => {
    const f = DIR + 'vendor/gstatic/' + nodePath.basename(new URL(r.request().url()).pathname);
    fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f) }) : r.abort(); });
}

const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const result = { measuredAt: new Date().toISOString(), pages: {} };

for (const [pname, purl] of PAGES) {
  result.pages[pname] = {};
  for (const [vname, vw, vh] of VIEWPORTS) {
    const ctx = await b.newContext({ viewport: { width: vw, height: vh },
      ...(vname.startsWith('mobile') ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    routes(ctx);
    const p = await ctx.newPage();

    // ---- byte accounting
    const bytes = { js: 0, css: 0, image: 0, font: 0, html: 0, other: 0 };
    const reqs = { total: 0, failed: 0 };
    const errors = [];
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    p.on('requestfailed', r => { reqs.failed++; });
    p.on('response', async resp => {
      reqs.total++;
      const ct = (resp.headers()['content-type'] || '').split(';')[0];
      let len = +(resp.headers()['content-length'] || 0);
      if (!len) { try { len = (await resp.body()).length; } catch { len = 0; } }
      const k = /javascript|ecmascript/.test(ct) ? 'js'
              : /css/.test(ct) ? 'css'
              : /^image\//.test(ct) ? 'image'
              : /font|woff/.test(ct) ? 'font'
              : /html/.test(ct) ? 'html' : 'other';
      bytes[k] += len;
    });

    // ---- long-task + LCP + CLS observers, installed before navigation
    await p.addInitScript(() => {
      window.__lt = []; window.__cls = 0; window.__lcp = 0; window.__rafTicks = 0;
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration))))
              .observe({ type: 'longtask', buffered: true }); } catch {}
      try { new PerformanceObserver(l => l.getEntries().forEach(e => { window.__lcp = Math.round(e.startTime); }))
              .observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
      try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) window.__cls += e.value; }))
              .observe({ type: 'layout-shift', buffered: true }); } catch {}
      // count how many rAF callbacks the page schedules while idle
      const origRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = function (cb) { window.__rafTicks++; return origRAF.call(window, cb); };
    });

    const t0 = Date.now();
    await p.goto('http://127.0.0.1:8777' + purl, { waitUntil: 'load' });
    const loadWall = Date.now() - t0;
    await p.waitForTimeout(1200);

    const nav = await p.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0] || {};
      return { domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
               load: Math.round(n.loadEventEnd || 0),
               firstPaint: Math.round((performance.getEntriesByName('first-paint')[0] || {}).startTime || 0) };
    });

    // ---- idle rAF churn: how many frames are scheduled with no interaction
    const idleTicks = await p.evaluate(() => new Promise(res => {
      const start = window.__rafTicks; setTimeout(() => res(window.__rafTicks - start), 2000);
    }));

    // ---- scroll jank: drive a fixed-duration scroll, sample frame intervals
    const scroll = await p.evaluate(() => new Promise(res => {
      const H = document.body.scrollHeight - window.innerHeight;
      if (H <= 0) return res({ frames: 0, dropped: 0, worst: 0, median: 0 });
      const ivals = []; let last = performance.now(); let y = 0;
      const DUR = 3000, t0 = last;
      function frame(now) {
        ivals.push(now - last); last = now;
        const prog = Math.min(1, (now - t0) / DUR);
        window.scrollTo(0, Math.round(H * prog));
        if (prog < 1) requestAnimationFrame(frame);
        else {
          const s = ivals.slice(1).sort((a, b) => a - b);
          res({ frames: ivals.length,
                dropped: s.filter(v => v > 20).length,
                badlyDropped: s.filter(v => v > 50).length,
                worst: Math.round(Math.max(...s)),
                median: Math.round(s[Math.floor(s.length / 2)] || 0) });
        }
      }
      requestAnimationFrame(frame);
    }));

    const obs = await p.evaluate(() => ({
      longTasks: window.__lt.length,
      longTasksOver50: window.__lt.filter(d => d > 50).length,
      longTaskTotalMs: window.__lt.reduce((a, c) => a + c, 0),
      lcp: window.__lcp, cls: +window.__cls.toFixed(4),
      images: document.images.length,
      domNodes: document.querySelectorAll('*').length,
    }));

    result.pages[pname][vname] = {
      loadWallMs: loadWall, ...nav, ...obs,
      idleRafTicksIn2s: idleTicks,
      bytes: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)])),
      totalKB: Math.round(Object.values(bytes).reduce((a, c) => a + c, 0) / 1024),
      requests: reqs.total, failedRequests: reqs.failed,
      consoleErrors: errors.length, consoleErrorSamples: errors.slice(0, 3),
      scroll,
    };
    console.log(pname, vname,
      'load=' + nav.load + 'ms', 'LCP=' + obs.lcp, 'CLS=' + obs.cls,
      'KB=' + result.pages[pname][vname].totalKB,
      'longTasks>50=' + obs.longTasksOver50,
      'idleRAF/2s=' + idleTicks,
      'scrollDropped=' + scroll.dropped + '/' + scroll.frames,
      'worstFrame=' + scroll.worst + 'ms');
    await ctx.close();
  }
}
await b.close();
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log('wrote', OUT);
