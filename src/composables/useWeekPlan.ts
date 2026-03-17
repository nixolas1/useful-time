import { ref } from 'vue'
import type { StorageAdapter, WeekPlan, DayAllocation, DayDefaults } from '../types'
import { DEFAULT_DAY_DEFAULTS } from '../types'

const STORAGE_KEY = 'weekPlans'

/**
 * Add days to a YYYY-MM-DD date string and return a new YYYY-MM-DD string.
 * Uses UTC to avoid timezone shift issues.
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00Z') // noon UTC avoids DST edge cases
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function useWeekPlan(storage: StorageAdapter) {
  const weekPlans = ref<WeekPlan[]>(
    storage.get<WeekPlan[]>(STORAGE_KEY) ?? [],
  )

  function persist() {
    storage.set(STORAGE_KEY, weekPlans.value)
  }

  function getDayDefaults(): DayDefaults {
    return storage.get<DayDefaults>('dayDefaults') ?? DEFAULT_DAY_DEFAULTS
  }

  function createWeekPlan(weekStart: string): WeekPlan {
    // Don't duplicate
    const existing = weekPlans.value.find((wp) => wp.weekStart === weekStart)
    if (existing) return existing

    const defaults = getDayDefaults()
    const dailyAllocations: DayAllocation[] = []

    for (let i = 0; i < 5; i++) {
      dailyAllocations.push({
        date: addDays(weekStart, i),
        meetings: [],
        overhead: defaults.overhead,
        adHocBudget: defaults.adHocBudget,
        projectAllocations: [],
      })
    }

    const plan: WeekPlan = {
      weekStart,
      focusProjects: [],
      dailyAllocations,
    }

    weekPlans.value.push(plan)
    persist()
    return plan
  }

  function getWeekPlan(weekStart: string): WeekPlan | undefined {
    return weekPlans.value.find((wp) => wp.weekStart === weekStart)
  }

  function addFocusProject(weekStart: string, projectId: string): void {
    const wp = weekPlans.value.find((w) => w.weekStart === weekStart)
    if (!wp) throw new Error(`Week plan not found: ${weekStart}`)

    // Deduplicate
    if (wp.focusProjects.includes(projectId)) return

    if (wp.focusProjects.length >= 3) {
      throw new Error('Maximum 3 focus projects per week')
    }

    wp.focusProjects.push(projectId)
    persist()
  }

  function removeFocusProject(weekStart: string, projectId: string): void {
    const wp = weekPlans.value.find((w) => w.weekStart === weekStart)
    if (!wp) throw new Error(`Week plan not found: ${weekStart}`)

    const idx = wp.focusProjects.indexOf(projectId)
    if (idx !== -1) {
      wp.focusProjects.splice(idx, 1)
      persist()
    }
  }

  function updateDayAllocation(
    weekStart: string,
    date: string,
    updates: Partial<Omit<DayAllocation, 'date'>>,
  ): void {
    const wpIdx = weekPlans.value.findIndex((w) => w.weekStart === weekStart)
    if (wpIdx === -1) throw new Error(`Week plan not found: ${weekStart}`)

    const dayIdx = weekPlans.value[wpIdx].dailyAllocations.findIndex(
      (d) => d.date === date,
    )
    if (dayIdx === -1) throw new Error(`Day not found: ${date}`)

    const day = weekPlans.value[wpIdx].dailyAllocations[dayIdx]
    weekPlans.value[wpIdx].dailyAllocations[dayIdx] = { ...day, ...updates }
    persist()
  }

  return {
    weekPlans,
    createWeekPlan,
    getWeekPlan,
    addFocusProject,
    removeFocusProject,
    updateDayAllocation,
  }
}
