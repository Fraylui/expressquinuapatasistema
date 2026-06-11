/* Audit screenshots de /gerente y /reportes en claro y oscuro */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // Login real por la UI
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'kevin.sandoval@quinuapata.com')
  await page.fill('input[type="password"]', 'Quinuapata2026!')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(3000)

  const shots = [
    ['gerente',  'Gerencial'],
    ['reportes', 'Reportes'],
  ]

  for (const [name, linkText] of shots) {
    await page.click(`aside >> text=${linkText}`)
    await page.waitForTimeout(4000)
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `audit-${name}-light.png`, fullPage: true })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.waitForTimeout(400)
    await page.screenshot({ path: `audit-${name}-dark.png`, fullPage: true })
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
  }

  await browser.close()
  console.log('OK url final:', page.url())
})().catch(e => { console.error(e); process.exit(1) })
