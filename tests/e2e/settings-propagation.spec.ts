import { test, expect } from '@playwright/test'

function getTodayWeekday(): string {
  const now = new Date()
  const d = new Date(now)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  else if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  return d.toISOString().split('T')[0]
}

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

test.describe('Settings propagation to charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('changing overhead in settings updates week view side panel', async ({ page }) => {
    await page.goto('/settings')

    // Change overhead from 1.5 to 3.0
    const overheadInput = page.locator('.form-field:has(.field-label:text("Overhead Budget")) input')
    await overheadInput.fill('3')
    await overheadInput.dispatchEvent('change')

    // Navigate to week view
    await page.locator('.back-btn').click()
    await expect(page).toHaveURL(/\/week\//)

    // Side panel: Overhead = 3.0 × 5 days = 15h
    const overheadStat = page.locator('.stat-item:has(.stat-label:text("Overhead")) .stat-value')
    await expect(overheadStat).toHaveText('15h')
  })

  test('changing ad-hoc budget in settings updates week view side panel', async ({ page }) => {
    await page.goto('/settings')

    // Change ad-hoc from 1.5 to 2.0
    const adHocInput = page.locator('.form-field:has(.field-label:text("Ad-hoc Budget")) input')
    await adHocInput.fill('2')
    await adHocInput.dispatchEvent('change')

    // Navigate to week view
    await page.locator('.back-btn').click()
    await expect(page).toHaveURL(/\/week\//)

    // Side panel: Ad-hoc = 2.0 × 5 days = 10h
    const adHocStat = page.locator('.stat-item:has(.stat-label:text("Ad-hoc")) .stat-value')
    await expect(adHocStat).toHaveText('10h')
  })

  test('changing overhead in settings updates day view breakdown', async ({ page }) => {
    await page.goto('/settings')

    // Change overhead to 2.5
    const overheadInput = page.locator('.form-field:has(.field-label:text("Overhead Budget")) input')
    await overheadInput.fill('2.5')
    await overheadInput.dispatchEvent('change')

    // Navigate to day view
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)

    // Breakdown: Overhead = 2.5h
    const overheadValue = page.locator('.breakdown-item:has(.breakdown-label:text("Overhead")) .breakdown-value')
    await expect(overheadValue).toHaveText('2.5h')
  })

  test('changing ad-hoc budget in settings updates day view breakdown', async ({ page }) => {
    await page.goto('/settings')

    // Change ad-hoc to 2.0
    const adHocInput = page.locator('.form-field:has(.field-label:text("Ad-hoc Budget")) input')
    await adHocInput.fill('2')
    await adHocInput.dispatchEvent('change')

    // Navigate to day view
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)

    // Breakdown: Ad-hoc = 2h
    const adHocValue = page.locator('.breakdown-item:has(.breakdown-label:text("Ad-hoc")) .breakdown-value')
    await expect(adHocValue).toHaveText('2h')
  })

  test('settings changes propagate even with existing week plan', async ({ page }) => {
    const monday = getCurrentWeekMonday()

    // 1. Create a project
    await page.goto('/settings')
    await page.locator('.new-project-btn').click()
    await page.locator('input[placeholder="Project name"]').fill('Test Project')
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill(monday)
    await dateInputs.nth(1).fill('2026-06-30')
    await page.locator('button:has-text("Create Project")').click()
    await expect(page.locator('.project-card')).toBeVisible()

    // 2. Go to week view, select the project as focus and assign to Mon
    await page.goto(`/week/${monday}`)
    await expect(page.locator('.focus-selector')).toBeVisible()
    await page.locator('.project-option').first().click()
    await expect(page.locator('.day-grid')).toBeVisible()
    // Click Monday cell to assign the project
    await page.locator('.grid-cell').first().click()
    // Verify it's assigned (cell becomes active)
    await expect(page.locator('.grid-cell').first()).toHaveClass(/active/)

    // 3. Verify initial overhead in side panel (1.5 × 5 = 7.5h)
    const overheadStat = page.locator('.stat-item:has(.stat-label:text("Overhead")) .stat-value')
    await expect(overheadStat).toHaveText('7.5h')

    // 4. Go to settings and change overhead to 2.0
    await page.locator('button[title="Settings"]').click()
    await expect(page).toHaveURL(/\/settings/)
    const overheadInput = page.locator('.form-field:has(.field-label:text("Overhead Budget")) input')
    await overheadInput.fill('2')
    await overheadInput.dispatchEvent('change')

    // 5. Go back to week view
    await page.locator('.back-btn').click()
    await expect(page).toHaveURL(/\/week\//)

    // 6. Verify overhead updated to 2.0 × 5 = 10h (even with existing plan)
    await expect(overheadStat).toHaveText('10h')
  })

  test('meeting buffer field shows minutes', async ({ page }) => {
    await page.goto('/settings')

    // The label should say "minutes"
    const bufferLabel = page.locator('.field-label:text("Meeting Buffer (minutes)")')
    await expect(bufferLabel).toBeVisible()

    // Default value should be 15 (minutes), not 0.25 (hours)
    const bufferInput = page.locator('.form-field:has(.field-label:text("Meeting Buffer")) input')
    await expect(bufferInput).toHaveValue('15')

    // Step should be 5
    await expect(bufferInput).toHaveAttribute('step', '5')
    await expect(bufferInput).toHaveAttribute('max', '60')
  })

  test('changing work hours updates chart Y-axis and stats', async ({ page }) => {
    await page.goto('/settings')

    // Change work hours from 8 to 6
    const workHoursInput = page.locator('.form-field:has(.field-label:text("Work Hours")) input')
    await workHoursInput.fill('6')
    await workHoursInput.dispatchEvent('change')

    // Go to week view — check that the chart uses the new workHours
    await page.locator('.back-btn').click()
    await expect(page).toHaveURL(/\/week\//)

    // The chart SVG should be visible (it renders with the new Y scale)
    await expect(page.locator('.chart-section svg')).toBeVisible()

    // The Y-axis should show "6h" as max tick
    const yAxisText = page.locator('.chart-section svg text')
    await expect(yAxisText.filter({ hasText: '6h' })).toBeVisible()
  })

  test('donut chart center shows correct available hours after settings change', async ({ page }) => {
    // Change overhead to 3.0 and ad-hoc to 1.0 (3+1=4 of 8h used, 4h project time)
    await page.goto('/settings')

    const overheadInput = page.locator('.form-field:has(.field-label:text("Overhead Budget")) input')
    await overheadInput.fill('3')
    await overheadInput.dispatchEvent('change')

    const adHocInput = page.locator('.form-field:has(.field-label:text("Ad-hoc Budget")) input')
    await adHocInput.fill('1')
    await adHocInput.dispatchEvent('change')

    // Go to day view
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)

    // Donut should render with the new segments
    await expect(page.locator('.donut-wrapper svg')).toBeVisible()

    // Project time breakdown should show 4h (8 - 3 - 1 = 4, no meetings)
    const projectValue = page.locator('.breakdown-item:has(.breakdown-label:text("Project time")) .breakdown-value')
    await expect(projectValue).toHaveText('4h')
  })
})
