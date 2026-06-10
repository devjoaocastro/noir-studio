#!/usr/bin/env node
/**
 * Deterministic scroll-reel recorder for the 3D sites.
 * Chromium virtual time (CDP) — page clock advances exactly 1/fps per frame,
 * so rAF animations + drei ScrollControls damping render as perfect 60/120fps
 * with zero dropped frames, regardless of capture speed.
 *
 * Usage: node record.mjs <url> <slug> [fps=60] [seconds=14] [w=1920] [h=1080]
 * Output: /tmp/reels/<slug>.mp4 (H.264 crf18) — frames in /tmp/reels/<slug>/
 */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const [url, slug, fpsArg, secArg, wArg, hArg] = process.argv.slice(2);
if (!url || !slug) { console.error('usage: record.mjs <url> <slug> [fps] [s] [w] [h]'); process.exit(1); }
const FPS = Number(fpsArg ?? 60);
const SECONDS = Number(secArg ?? 14);
const W = Number(wArg ?? 1920), H = Number(hArg ?? 1080);
const FRAMES = FPS * SECONDS;
const OUT = `/tmp/reels/${slug}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const cdp = await page.context().newCDPSession(page);

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
// real-time settle: loader + assets + first renders
await page.waitForTimeout(9000);
// dismiss intro overlays (e.g. VROOM START button) if present
try { await page.click('button:has-text("START")', { timeout: 1500 }); await page.waitForTimeout(2500); } catch {}

// locate the drei ScrollControls scroller (largest scrollable div)
const hasScroller = await page.evaluate(() => {
  const divs = [...document.querySelectorAll('div')];
  const s = divs
    .filter((d) => d.scrollHeight > d.clientHeight * 1.5 && ['auto', 'scroll'].includes(getComputedStyle(d).overflowY))
    .sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
  if (!s) return false;
  window.__scroller = s;
  window.__max = s.scrollHeight - s.clientHeight;
  return true;
});

// pause the page clock, then advance it frame by frame
const advance = (ms) =>
  new Promise((resolve) => {
    const once = () => { cdp.off('Emulation.virtualTimeBudgetExpired', once); resolve(); };
    cdp.on('Emulation.virtualTimeBudgetExpired', once);
    cdp.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: ms });
  });
await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2); // easeInOutQuad
for (let i = 0; i < FRAMES; i++) {
  if (hasScroller) {
    const p = ease(i / (FRAMES - 1));
    await page.evaluate((prog) => { window.__scroller.scrollTop = window.__max * prog; }, p);
  }
  await advance(1000 / FPS);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
  fs.writeFileSync(`${OUT}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(data, 'base64'));
  if (i % 120 === 0) console.log(`${slug}: frame ${i}/${FRAMES}`);
}
await browser.close();

execSync(
  `ffmpeg -y -framerate ${FPS} -i ${OUT}/f%05d.jpg -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart /tmp/reels/${slug}.mp4`,
  { stdio: 'ignore' },
);
const size = fs.statSync(`/tmp/reels/${slug}.mp4`).size;
console.log(`${slug}: ✓ /tmp/reels/${slug}.mp4 (${(size / 1e6).toFixed(1)}MB, ${FPS}fps, ${SECONDS}s)`);
fs.rmSync(OUT, { recursive: true, force: true });
