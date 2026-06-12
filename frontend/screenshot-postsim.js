/* Capturas post-simulación: tablero, gerencial, reportes y viajes con datos reales */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'kevin.sandoval@quinuapata.com')
  await page.fill('input[type="password"]', 'Quinuapata2026!')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'sim-tablero.png' })

  for (const [link, url, file] of [
    ['Gerencial', 'gerente', 'sim-gerencial'],
    ['Reportes', 'reportes', 'sim-reportes'],
    ['Viajes', 'viajes', 'sim-viajes'],
  ]) {
    await page.getByRole('link', { name: link }).click()
    await page.waitForURL(`**/${url}`, { timeout: 15000 })
    await page.waitForTimeout(4000)
    await page.screenshot({ path: `${file}.png` })
  }
  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
