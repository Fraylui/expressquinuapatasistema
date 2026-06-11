/* Capturas de /promociones y /clientes como GERENTE */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', 'kevin.sandoval@quinuapata.com')
  await page.fill('input[type="password"]', 'Quinuapata2026!')
  await page.click('button[type="submit"]')
  await page.waitForURL(u => !String(u).includes('/login'), { timeout: 20000 })
  await page.waitForTimeout(2500)

  await page.click('a[href="/promociones"]')
  await page.waitForURL('**/promociones', { timeout: 15000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'audit-promos.png', fullPage: true })
  // Abrir form de nueva promo
  const botones = ['text=Nueva promoción', 'text=Nueva promo', 'text=Crear promoción', 'text=Nueva']
  for (const b of botones) { try { await page.click(b, { timeout: 1500 }); break } catch {} }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'audit-promos-form.png', fullPage: true })

  await page.goto('http://localhost:3000/clientes', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(3500)
  if (!page.url().includes('/clientes')) {
    await page.click('a[href="/clientes"]')
    await page.waitForTimeout(3500)
  }
  await page.screenshot({ path: 'audit-clientes.png', fullPage: true })

  await browser.close()
  console.log('OK', page.url())
})().catch(e => { console.error(e); process.exit(1) })
