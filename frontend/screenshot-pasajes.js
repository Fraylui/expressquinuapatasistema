/* Capturas de /pasajes (flujo de venta) como OPERADOR */
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
  await page.click('a[href="/pasajes"]')
  await page.waitForURL('**/pasajes', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'audit-pasajes-paso1.png', fullPage: true })
  // dark también del paso 1
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'audit-pasajes-paso1-dark.png', fullPage: true })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
