import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:4173'
const stamp = Date.now()
const userA = {
  name: 'Alex Dom',
  email: `alex.${stamp}@example.com`,
  password: 'testpass123',
}
const userB = {
  name: 'Blake Sub',
  email: `blake.${stamp}@example.com`,
  password: 'testpass123',
}

async function fillByLabel(page, labelText, value) {
  const input = page.locator(`label:has-text("${labelText}") input, label:has-text("${labelText}") select`).first()
  await input.fill(value)
}

async function selectRole(page, role) {
  await page.locator('label:has-text("Your role") select').selectOption(role)
}

async function signUp(page, { name, email, password }) {
  await page.goto(`${BASE}/auth`)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await fillByLabel(page, 'Display name', name)
  await fillByLabel(page, 'Email', email)
  await fillByLabel(page, 'Password', password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL('**/onboarding')
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext()
  const page = await context.newPage()
  const results = []

  try {
    // Unauthenticated root should redirect to auth
    await page.goto(BASE)
    await page.waitForURL('**/auth')
    results.push(['redirect unauthenticated → /auth', page.url().includes('/auth')])

    // User A signs up and creates a relationship
    await signUp(page, userA)
    results.push(['user A reaches onboarding', page.url().includes('/onboarding')])

    await fillByLabel(page, 'Relationship name', 'Primary dynamic')
    await selectRole(page, 'dominant')
    await page.getByRole('button', { name: 'Create relationship' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    results.push(['user A lands on dashboard', page.url().endsWith('/') || new URL(page.url()).pathname === '/'])

    await page.locator('main').getByRole('heading', { name: 'Dashboard' }).waitFor()
    await page.locator('main').getByText('Primary dynamic', { exact: true }).first().waitFor()
    const inviteCode = (await page.locator('main code').first().innerText()).trim()
    results.push(['invite code shown', /^[A-Z0-9]{6}$/.test(inviteCode)])
    console.log('invite code:', inviteCode)

    // Sign out via settings
    await page.goto(`${BASE}/settings`)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.waitForURL('**/auth')
    results.push(['sign out → /auth', page.url().includes('/auth')])

    // User B joins with invite code
    await signUp(page, userB)
    await page.getByRole('button', { name: 'Join with code' }).click()
    await fillByLabel(page, 'Invite code', inviteCode)
    await selectRole(page, 'submissive')
    await page.getByRole('button', { name: 'Join relationship' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    await page.locator('main').getByText('Primary dynamic', { exact: true }).first().waitFor()
    const membersText = await page.locator('main').getByText('Members:').innerText()
    results.push([
      'user B sees both members',
      membersText.includes('Alex Dom') && membersText.includes('Blake Sub'),
    ])
    results.push([
      'user B role is submissive',
      (await page.locator('main').getByText('Your role:').innerText()).includes('submissive'),
    ])

    // Create a second relationship and switch
    await page.goto(`${BASE}/onboarding`)
    await fillByLabel(page, 'Relationship name', 'Second dynamic')
    await selectRole(page, 'switch')
    await page.getByRole('button', { name: 'Create relationship' }).click()
    await page.waitForURL((url) => url.pathname === '/')
    await page.locator('main').getByText('Second dynamic', { exact: true }).first().waitFor()
    results.push([
      'second relationship created',
      (await page.locator('main').innerText()).includes('Second dynamic'),
    ])

    const switcher = page.locator('aside select')
    await switcher.selectOption({ label: 'Primary dynamic' })
    await page.locator('main').getByText('Primary dynamic', { exact: true }).first().waitFor()
    const afterSwitch = await page.locator('main').innerText()
    results.push(['switcher restores primary', afterSwitch.includes('Primary dynamic')])

    // Settings shows invite + members
    await page.goto(`${BASE}/settings`)
    await page.locator('main').getByText(inviteCode).waitFor()
    results.push(['settings shows invite code', (await page.locator('main').innerText()).includes(inviteCode)])
  } catch (err) {
    console.error('TEST FAILURE:', err)
    await page.screenshot({ path: '/tmp/subrosa-auth-fail.png', fullPage: true })
    console.error('screenshot: /tmp/subrosa-auth-fail.png')
    console.error('url:', page.url())
    console.error('body snippet:', (await page.locator('body').innerText()).slice(0, 800))
    process.exitCode = 1
  } finally {
    console.log('\nResults:')
    for (const [name, ok] of results) {
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
      if (!ok) process.exitCode = 1
    }
    await browser.close()
  }
}

main()
