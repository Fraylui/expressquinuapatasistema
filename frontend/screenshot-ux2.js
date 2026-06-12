/* Re-captura tras fixes: GERENTE en /usuarios (botón módulos), página de módulos
   de un operador, /agencias (botones de gestión) y prueba de foco del formulario */
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
  const page = await loginAs(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!')

  // /usuarios con el botón de módulos visible para operadores
  await page.getByRole('link', { name: 'Usuarios' }).click()
  await page.waitForURL('**/usuarios', { timeout: 15000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'ux2-usuarios-ger.png', fullPage: true })

  // Página de módulos de Carlos (OPERADOR) como GERENTE
  const filaCarlos = page.locator('tr', { hasText: 'Carlos' })
  await filaCarlos.locator('a[href*="/modulos"] button').click()
  await page.waitForURL('**/modulos', { timeout: 15000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'ux2-modulos-carlos-ger.png', fullPage: true })

  // /agencias como GERENTE: Nueva agencia + Agregar sucursal visibles, sin Desactivar
  await page.getByRole('link', { name: 'Agencias' }).click()
  await page.waitForURL('**/agencias', { timeout: 15000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: 'ux2-agencias-ger.png', fullPage: true })

  // Prueba de foco: abrir Nueva agencia y teclear de corrido
  await page.getByRole('button', { name: 'Nueva agencia' }).click()
  await page.waitForTimeout(800)
  await page.getByPlaceholder('Sede Ayacucho').click()
  await page.keyboard.type('Sede Pichari Centro', { delay: 30 })
  await page.getByPlaceholder('AYA-02').click()
  await page.keyboard.type('PIC-02', { delay: 30 })
  await page.screenshot({ path: 'ux2-agencias-form-foco.png', fullPage: false })
  const nombreVal = await page.getByPlaceholder('Sede Ayacucho').inputValue()
  const codigoVal = await page.getByPlaceholder('AYA-02').inputValue()
  console.log('nombre tecleado:', JSON.stringify(nombreVal))
  console.log('codigo tecleado:', JSON.stringify(codigoVal))

  await browser.close()
  console.log('OK')
})().catch(e => { console.error(e); process.exit(1) })
