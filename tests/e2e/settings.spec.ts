import { test, expect } from '@playwright/test'

test.describe('Settings View', () => {
  test('settings page loads with sections', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('.settings-view')).toBeVisible()
    await expect(page.locator('.settings-title')).toHaveText('Settings')

    // Should have Projects, Day Defaults, and Data sections
    await expect(page.locator('.section-title:has-text("Projects")')).toBeVisible()
    await expect(page.locator('.section-title:has-text("Day Defaults")')).toBeVisible()
    await expect(page.locator('.section-title:has-text("Data")')).toBeVisible()
  })

  test('shows empty state when no projects', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('.empty-state')).toBeVisible()
    await expect(page.locator('.empty-state')).toContainText('No active projects')
  })

  test('can create a project', async ({ page }) => {
    await page.goto('/settings')

    // Click New Project
    await page.locator('.new-project-btn').click()

    // Modal should appear
    await expect(page.locator('.modal-overlay')).toBeVisible()
    await expect(page.locator('.form-title')).toHaveText('New Project')

    // Fill the form
    await page.locator('input[placeholder="Project name"]').fill('My Test Project')

    // Dates are pre-filled, but let's set specific ones
    const dateInputs = page.locator('input[type="date"]')
    await dateInputs.nth(0).fill('2026-03-16')
    await dateInputs.nth(1).fill('2026-04-30')

    // Click Create Project
    await page.locator('button:has-text("Create Project")').click()

    // Modal should close
    await expect(page.locator('.modal-overlay')).not.toBeVisible()

    // Project card should appear
    await expect(page.locator('.project-card')).toBeVisible()
    await expect(page.locator('.project-card')).toContainText('My Test Project')
  })

  test('day defaults form has all fields', async ({ page }) => {
    await page.goto('/settings')
    const form = page.locator('.defaults-form')
    await expect(form).toBeVisible()

    await expect(form.locator('.field-label:has-text("Work Hours")')).toBeVisible()
    await expect(form.locator('.field-label:has-text("Workday Start")')).toBeVisible()
    await expect(form.locator('.field-label:has-text("Overhead Budget")')).toBeVisible()
    await expect(form.locator('.field-label:has-text("Ad-hoc Budget")')).toBeVisible()
    await expect(form.locator('.field-label:has-text("Meeting Buffer")')).toBeVisible()
  })

  test('export JSON triggers download', async ({ page }) => {
    await page.goto('/settings')

    const downloadPromise = page.waitForEvent('download')
    await page.locator('button:has-text("Export JSON")').click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toMatch(/useful-time-export.*\.json/)
  })

  test('back button navigates away', async ({ page }) => {
    // Start from week view, then go to settings
    await page.goto('/')
    await page.waitForURL(/\/week\//)
    await page.locator('button[title="Settings"]').click()
    await expect(page).toHaveURL(/\/settings/)

    // Click back
    await page.locator('.back-btn').click()
    await expect(page).toHaveURL(/\/week\//)
  })

  test('import JSON restores data', async ({ page }) => {
    await page.goto('/settings')

    // First create a project
    await page.locator('.new-project-btn').click()
    await page.locator('input[placeholder="Project name"]').fill('Export Test')
    await page.locator('button:has-text("Create Project")').click()
    await expect(page.locator('.project-card')).toContainText('Export Test')

    // Export
    const downloadPromise = page.waitForEvent('download')
    await page.locator('button:has-text("Export JSON")').click()
    const download = await downloadPromise
    const filePath = await download.path()

    // Clear localStorage and reload
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.locator('.empty-state')).toBeVisible()

    // Import the file back
    const fileInput = page.locator('input[type="file"][accept=".json"]')
    await fileInput.setInputFiles(filePath!)

    // Project should reappear
    await expect(page.locator('.project-card')).toContainText('Export Test')
  })
})
