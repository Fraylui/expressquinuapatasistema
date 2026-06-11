/* Capturas de /encomiendas-externas: lista + formulario de registro */
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
  await page.click('a[href="/encomiendas-externas"]')
  await page.waitForURL('**/encomiendas-externas', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'audit-ext-lista.png', fullPage: true })

  // Abrir registro (botón "Nueva" / "Registrar")
  const botones = ['text=Nueva recepción', 'text=Nueva encomienda', 'text=Registrar', 'text=Recepcionar', 'text=Nueva']
  for (const b of botones) {
    try { await page.click(b, { timeout: 1500 }); break } catch {}
  }
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'audit-ext-registro.png', fullPage: true })

  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
