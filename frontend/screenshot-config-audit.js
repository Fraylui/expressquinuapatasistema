/* Auditoría UX: /configuracion (6 tabs, como GERENTE) y /auditoria (SUPER_ADMIN) */
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

  // ── GERENTE: /configuracion, tab por tab ──
  let page = await loginAs(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!')
  await page.getByRole('link', { name: 'Configuración' }).click()
  await page.waitForURL('**/configuracion', { timeout: 15000 })
  await page.waitForTimeout(3500)

  const tabs = ['Empresa', 'Rutas', 'Tarifas', 'Temporadas', 'Vehículos', 'Conductores']
  for (const t of tabs) {
    try {
      await page.getByRole('button', { name: t, exact: true }).first().click()
    } catch {
      await page.click(`text=${t}`)
    }
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `cfg-${t.toLowerCase().replace('í', 'i')}.png`, fullPage: true })
  }
  await page.close()

  // ── SUPER_ADMIN: /auditoria ──
  page = await loginAs(browser, 'superadmin@expressvraem.com', 'SuperAdmin2026!')
  await page.getByRole('link', { name: 'Auditoría' }).click()
  await page.waitForURL('**/auditoria', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'aud-principal.png', fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'aud-principal-dark.png', fullPage: true })
  await page.close()

  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
