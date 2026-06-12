/* Auditoría UX: /usuarios y /agencias como SUPER_ADMIN y GERENTE (claro/oscuro) */
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

async function capture(page, linkText, urlPart, prefix) {
  await page.getByRole('link', { name: linkText }).click()
  await page.waitForURL(`**/${urlPart}`, { timeout: 15000 })
  await page.waitForTimeout(4000)
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${prefix}-light.png`, fullPage: true })
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${prefix}-dark.png`, fullPage: true })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
}

;(async () => {
  const browser = await chromium.launch()

  let page = await loginAs(browser, 'superadmin@expressvraem.com', 'SuperAdmin2026!')
  await capture(page, 'Usuarios', 'usuarios', 'ux-usuarios-sa')
  await capture(page, 'Agencias', 'agencias', 'ux-agencias-sa')
  await page.close()

  page = await loginAs(browser, 'kevin.sandoval@quinuapata.com', 'Quinuapata2026!')
  await capture(page, 'Usuarios', 'usuarios', 'ux-usuarios-ger')
  await capture(page, 'Agencias', 'agencias', 'ux-agencias-ger')
  await page.close()

  await browser.close()
  console.log('OK — 8 capturas')
})().catch(e => { console.error(e); process.exit(1) })
