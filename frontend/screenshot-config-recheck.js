/* Re-captura tras fixes: tarifas con temporada, temporadas con duración,
   empresa (cuota combi, scroll) y auditoría con hora Lima */
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

  let page = await loginAs(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!')
  await page.getByRole('link', { name: 'Configuración' }).click()
  await page.waitForURL('**/configuracion', { timeout: 15000 })
  await page.waitForTimeout(3000)

  // Empresa: scroll al fondo (cuota combi + guardar)
  const main = page.locator('main')
  await main.evaluate(el => el.scrollTo(0, el.scrollHeight))
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'cfg2-empresa-fondo.png' })

  // Tarifas con columna Temporada
  await page.getByRole('button', { name: 'Tarifas', exact: true }).first().click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'cfg2-tarifas.png' })

  // Temporadas con duración corregida
  await page.getByRole('button', { name: 'Temporadas', exact: true }).first().click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'cfg2-temporadas.png' })
  await page.close()

  // Auditoría con hora Lima
  page = await loginAs(browser, 'superadmin@expressvraem.com', 'SuperAdmin2026!')
  await page.getByRole('link', { name: 'Auditoría' }).click()
  await page.waitForURL('**/auditoria', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'aud2-principal.png' })
  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
