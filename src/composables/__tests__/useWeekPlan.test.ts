import { describe, it, expect, beforeEach } from 'vitest'
import { useWeekPlan } from '../useWeekPlan'
import type { StorageAdapter, DayDefaults, WeekPlan } from '../../types'
import { DEFAULT_DAY_DEFAULTS } from '../../types'

function createMockStorage(): StorageAdapter {
  const store: Record<string, unknown> = {}
  return {
    get<T>(key: string): T | null {
      return (store[key] as T) ?? null
    },
    set<T>(key: string, value: T): void {
      store[key] = value
    },
    exportAll(): string {
      return JSON.stringify(store)
    },
    importAll(json: string): void {
      Object.assign(store, JSON.parse(json))
    },
  }
}

describe('useWeekPlan', () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = createMockStorage()
  })

  describe('createWeekPlan', () => {
    it('creates a week plan initialized from defaults', () => {
      const { createWeekPlan, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09') // Monday
      expect(weekPlans.value).toHaveLength(1)
      const wp = weekPlans.value[0]
      expect(wp.weekStart).toBe('2026-03-09')
      expect(wp.focusProjects).toEqual([])
      expect(wp.dailyAllocations).toHaveLength(5) // Mon-Fri
    })

    it('initializes each day allocation from DayDefaults', () => {
      const { createWeekPlan, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      const day = weekPlans.value[0].dailyAllocations[0]
      expect(day.overhead).toBe(DEFAULT_DAY_DEFAULTS.overhead)
      expect(day.adHocBudget).toBe(DEFAULT_DAY_DEFAULTS.adHocBudget)
      expect(day.meetings).toEqual([])
      expect(day.projectAllocations).toEqual([])
    })

    it('generates correct dates for Mon-Fri', () => {
      const { createWeekPlan, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      const dates = weekPlans.value[0].dailyAllocations.map((d) => d.date)
      expect(dates).toEqual([
        '2026-03-09',
        '2026-03-10',
        '2026-03-11',
        '2026-03-12',
        '2026-03-13',
      ])
    })

    it('uses custom day defaults if provided', () => {
      const custom: DayDefaults = {
        ...DEFAULT_DAY_DEFAULTS,
        overhead: 2,
        adHocBudget: 0.5,
      }
      storage.set('dayDefaults', custom)
      const { createWeekPlan, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      const day = weekPlans.value[0].dailyAllocations[0]
      expect(day.overhead).toBe(2)
      expect(day.adHocBudget).toBe(0.5)
    })

    it('persists to storage', () => {
      const { createWeekPlan } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      const stored = storage.get<WeekPlan[]>('weekPlans')
      expect(stored).toHaveLength(1)
    })

    it('does not duplicate week if already exists', () => {
      const { createWeekPlan, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      createWeekPlan('2026-03-09')
      expect(weekPlans.value).toHaveLength(1)
    })
  })

  describe('focus projects', () => {
    it('adds a focus project', () => {
      const { createWeekPlan, addFocusProject, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      addFocusProject('2026-03-09', 'proj-1')
      expect(weekPlans.value[0].focusProjects).toEqual(['proj-1'])
    })

    it('enforces max 3 focus projects', () => {
      const { createWeekPlan, addFocusProject } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      addFocusProject('2026-03-09', 'proj-1')
      addFocusProject('2026-03-09', 'proj-2')
      addFocusProject('2026-03-09', 'proj-3')
      expect(() => addFocusProject('2026-03-09', 'proj-4')).toThrow(
        /max.*3|maximum.*3/i,
      )
    })

    it('does not add duplicate focus project', () => {
      const { createWeekPlan, addFocusProject, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      addFocusProject('2026-03-09', 'proj-1')
      addFocusProject('2026-03-09', 'proj-1')
      expect(weekPlans.value[0].focusProjects).toEqual(['proj-1'])
    })

    it('removes a focus project', () => {
      const { createWeekPlan, addFocusProject, removeFocusProject, weekPlans } =
        useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      addFocusProject('2026-03-09', 'proj-1')
      addFocusProject('2026-03-09', 'proj-2')
      removeFocusProject('2026-03-09', 'proj-1')
      expect(weekPlans.value[0].focusProjects).toEqual(['proj-2'])
    })
  })

  describe('daily allocation management', () => {
    it('updates day overhead', () => {
      const { createWeekPlan, updateDayAllocation, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      updateDayAllocation('2026-03-09', '2026-03-09', { overhead: 3 })
      expect(weekPlans.value[0].dailyAllocations[0].overhead).toBe(3)
    })

    it('updates day adHocBudget', () => {
      const { createWeekPlan, updateDayAllocation, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      updateDayAllocation('2026-03-09', '2026-03-10', { adHocBudget: 2 })
      expect(weekPlans.value[0].dailyAllocations[1].adHocBudget).toBe(2)
    })

    it('sets project allocations for a day', () => {
      const { createWeekPlan, updateDayAllocation, weekPlans } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      updateDayAllocation('2026-03-09', '2026-03-09', {
        projectAllocations: [{ projectId: 'p1', hours: 3 }],
      })
      expect(weekPlans.value[0].dailyAllocations[0].projectAllocations).toEqual([
        { projectId: 'p1', hours: 3 },
      ])
    })

    it('persists allocation updates', () => {
      const { createWeekPlan, updateDayAllocation } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      updateDayAllocation('2026-03-09', '2026-03-09', { overhead: 5 })
      const stored = storage.get<WeekPlan[]>('weekPlans')
      expect(stored![0].dailyAllocations[0].overhead).toBe(5)
    })

    it('throws for non-existent week', () => {
      const { updateDayAllocation } = useWeekPlan(storage)
      expect(() =>
        updateDayAllocation('2099-01-01', '2099-01-01', { overhead: 1 }),
      ).toThrow()
    })
  })

  describe('getWeekPlan', () => {
    it('returns the week plan for a given weekStart', () => {
      const { createWeekPlan, getWeekPlan } = useWeekPlan(storage)
      createWeekPlan('2026-03-09')
      const wp = getWeekPlan('2026-03-09')
      expect(wp).toBeDefined()
      expect(wp!.weekStart).toBe('2026-03-09')
    })

    it('returns undefined for non-existent week', () => {
      const { getWeekPlan } = useWeekPlan(storage)
      expect(getWeekPlan('2099-01-01')).toBeUndefined()
    })
  })
})
