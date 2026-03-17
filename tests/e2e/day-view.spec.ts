import { test, expect } from '@playwright/test'

function getTodayWeekday(): string {
  const now = new Date()
  const d = new Date(now)
  // If weekend, shift to Monday
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

test.describe('Day View', () => {
  test('day view loads and shows donut chart', async ({ page }) => {
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)
    await expect(page.locator('.day-view')).toBeVisible()
    await expect(page.locator('.donut-wrapper svg')).toBeVisible()
  })

  test('shows breakdown list', async ({ page }) => {
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)
    await expect(page.locator('.breakdown-items')).toBeVisible()
    // Should show the 4 categories
    await expect(page.locator('.breakdown-item')).toHaveCount(4)
  })

  test('shows meeting timeline section', async ({ page }) => {
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)
    await expect(page.locator('.timeline-section')).toBeVisible()
    // No meetings by default
    await expect(page.locator('.no-meetings')).toBeVisible()
  })

  test('day navigation skips weekends', async ({ page }) => {
    // Go to a Friday
    const monday = getCurrentWeekMonday()
    const friday = new Date(monday + 'T12:00:00')
    friday.setDate(friday.getDate() + 4)
    const fridayStr = friday.toISOString().split('T')[0]

    await page.goto(`/day/${fridayStr}`)
    await expect(page.locator('.day-view')).toBeVisible()

    // Click next — should skip to a weekday (not Saturday or Sunday)
    await page.locator('button[aria-label="Next"]').click()
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/)

    // Extract the date from URL and verify it's a weekday
    const url = page.url()
    const dateMatch = url.match(/\/day\/(\d{4}-\d{2}-\d{2})/)
    expect(dateMatch).not.toBeNull()
    const resultDay = new Date(dateMatch![1] + 'T12:00:00').getDay()
    expect(resultDay).toBeGreaterThanOrEqual(1)
    expect(resultDay).toBeLessThanOrEqual(5)
  })

  test('Today button navigates to today or nearest weekday', async ({ page }) => {
    const today = getTodayWeekday()
    // Go to a different day first
    const farDate = new Date(today + 'T12:00:00')
    farDate.setDate(farDate.getDate() + 14)
    // Skip weekends
    if (farDate.getDay() === 0) farDate.setDate(farDate.getDate() + 1)
    else if (farDate.getDay() === 6) farDate.setDate(farDate.getDate() + 2)
    const farStr = farDate.toISOString().split('T')[0]

    await page.goto(`/day/${farStr}`)
    await expect(page.locator('.day-view')).toBeVisible()

    await page.locator('.today-btn').click()
    await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}/)

    // Should no longer be on the far date
    await expect(page).not.toHaveURL(new RegExp(farStr))

    // Should be a weekday
    const url = page.url()
    const dateMatch = url.match(/\/day\/(\d{4}-\d{2}-\d{2})/)
    expect(dateMatch).not.toBeNull()
    const resultDay = new Date(dateMatch![1] + 'T12:00:00').getDay()
    expect(resultDay).toBeGreaterThanOrEqual(1)
    expect(resultDay).toBeLessThanOrEqual(5)
  })

  test('view toggle switches to week view', async ({ page }) => {
    const today = getTodayWeekday()
    await page.goto(`/day/${today}`)
    await page.locator('button:has-text("Week")').first().click()
    await expect(page).toHaveURL(/\/week\//)
  })
})
