/* Capturas de /encomiendas: tabs + formulario de registro */
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
  await page.click('a[href="/encomiendas"]')
  await page.waitForURL('**/encomiendas', { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: 'audit-enc-tabs.png', fullPage: true })

  // Abrir el formulario de registro
  await page.click('text=Nueva encomienda')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'audit-enc-nueva.png', fullPage: true })

  // Escribir un DNI inexistente: debe auto-buscar y abrir el registro inline
  await page.fill('input[placeholder="DNI (8 dígitos)"]', '99887766')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'audit-enc-noencontrado.png', fullPage: true })

  // Escribir un DNI existente (cliente del seed): debe cargar el panel verde
  await page.click('text=Cancelar venta >> visible=false').catch(() => {})

  // Dark del formulario
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'audit-enc-nueva-dark.png', fullPage: true })

  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
