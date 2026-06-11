/* Capturas de /manifiestos */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'carlos.quispe@quinuapata.com')
  await page.fill('input[type="password"]', 'Quinuapata2024!')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2500)
  await page.click('a[href="/manifiestos"]')
  await page.waitForURL('**/manifiestos', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'audit-manif-light.png', fullPage: true })

  // Seleccionar el primer viaje de la lista y capturar el detalle
  await page.click('text=Seleccionar viaje >> .. >> button >> nth=0').catch(async () => {
    await page.locator('.divide-y button').first().click()
  })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'audit-manif-detalle.png', fullPage: true })

  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'audit-manif-dark.png', fullPage: true })
  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
