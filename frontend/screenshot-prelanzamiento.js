/* Capturas de verificación pre-lanzamiento:
   - GERENTE: sidebar con logo + alerta caja +24h en /gerente (claro/oscuro)
   - ADMIN_AGENCIA: tablero + /reportes sin selectores de agencia/usuario */
const { chromium } = require('playwright')

async function loginAs(browser, email, pass) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', pass)
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(3000)
  return page
}

;(async () => {
  const browser = await chromium.launch()

  // ── GERENTE ──
  let page = await loginAs(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!')
  await page.screenshot({ path: 'pre-gerente-tablero.png', fullPage: false })
  await page.click('aside >> text=Gerencial')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'pre-gerente-gerencial-light.png', fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'pre-gerente-gerencial-dark.png', fullPage: true })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.close()

  // ── ADMIN_AGENCIA ──
  page = await loginAs(browser, 'elena.paredes@quinuapata.com', 'Quinuapata2024!')
  await page.screenshot({ path: 'pre-admin-tablero.png', fullPage: false })
  await page.click('aside >> text=Reportes')
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'pre-admin-reportes-light.png', fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'pre-admin-reportes-dark.png', fullPage: true })
  await page.close()

  await browser.close()
  console.log('OK — 6 capturas generadas')
})().catch(e => { console.error(e); process.exit(1) })
