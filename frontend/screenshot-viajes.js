/* Capturas de /viajes como OPERADOR y GERENTE, claro y oscuro */
const { chromium } = require('playwright')

async function captura(browser, email, pass, tag) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2500)
  await page.click('a[href="/viajes"]')
  await page.waitForURL('**/viajes', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `audit-viajes-${tag}-light.png`, fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `audit-viajes-${tag}-dark.png`, fullPage: true })
  await page.close()
}

;(async () => {
  const browser = await chromium.launch()
  await captura(browser, 'carlos.quispe@quinuapata.com', 'Quinuapata2024!', 'operador')
  await captura(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!', 'gerente')
  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
