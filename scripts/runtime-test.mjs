/* Runtime smoke test: boots vite preview, drives the car with real key
 * events and asserts gameplay + zero console errors. */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4646
const URL = `http://localhost:${PORT}/`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('preview server did not start')
}

const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
})

let failed = false
const fail = (msg) => {
  failed = true
  console.error(`FAIL: ${msg}`)
}
const pass = (msg) => console.log(`PASS: ${msg}`)

try {
  await waitForServer(URL)

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.start-btn', { timeout: 15000 })
  pass('intro overlay rendered')

  await page.click('.start-btn')
  await sleep(2500) // let camera settle + fonts/world render
  await page.screenshot({ path: path.join(root, 'shots', 'hero.png') })
  pass('START clicked, hero screenshot captured')

  const pos0 = await page.evaluate(() => [window.__game.carX, window.__game.carZ])

  /* 2s of KeyW → car must move */
  await page.keyboard.down('KeyW')
  await sleep(2000)
  const pos1 = await page.evaluate(() => [window.__game.carX, window.__game.carZ])
  const moved = Math.hypot(pos1[0] - pos0[0], pos1[1] - pos0[1])
  if (moved > 2) pass(`car moved ${moved.toFixed(1)} units after 2s of KeyW`)
  else fail(`car did not move (delta ${moved.toFixed(3)})`)

  /* keep driving north until the portfolio panel slides in (~6s total) */
  let panelOpen = false
  for (let i = 0; i < 30; i++) {
    panelOpen = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="panel"]')
      return !!el && el.classList.contains('is-open')
    })
    if (panelOpen) break
    await sleep(300)
  }
  await page.keyboard.up('KeyW')
  /* brake so the district screenshot frames the billboards, not empty ground */
  await page.keyboard.down('KeyS')
  await sleep(900)
  await page.keyboard.up('KeyS')

  if (panelOpen) {
    const zone = await page.getAttribute('[data-testid="panel"]', 'data-zone')
    const carZ = await page.evaluate(() => window.__game.carZ)
    if (zone === 'portfolio') pass(`portfolio panel opened (carZ=${carZ.toFixed(1)})`)
    else fail(`panel opened but zone is "${zone}"`)
  } else {
    fail('panel never opened while driving north')
  }

  const hud = await page.evaluate(() => ({
    explored: document.querySelector('.objective__chip')?.textContent ?? '',
    speed: document.querySelector('.speedo__num')?.textContent ?? '',
  }))
  if (hud.explored.includes('1/4')) pass(`zone counter updated: "${hud.explored}"`)
  else fail(`zone counter wrong: "${hud.explored}"`)

  await sleep(900) // panel slide-in finishes
  await page.screenshot({ path: path.join(root, 'shots', 'district.png') })
  pass('district screenshot captured')

  if (consoleErrors.length === 0) pass('0 console errors')
  else {
    fail(`${consoleErrors.length} console errors:`)
    consoleErrors.forEach((e) => console.error('  -', e))
  }

  await browser.close()
} catch (err) {
  fail(err.stack ?? String(err))
} finally {
  preview.kill()
}

process.exit(failed ? 1 : 0)
