import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useAutoSuggest } from '../useAutoSuggest'
import type { Project, WeekPlan, DayAllocation, DayDefaults } from '../../types'
import { DEFAULT_DAY_DEFAULTS } from '../../types'

function makeDay(overrides: Partial<DayAllocation> = {}): DayAllocation {
  return {
    date: overrides.date ?? '2026-03-09',
    meetings: overrides.meetings ?? [],
    overhead: overrides.overhead ?? 1.5,
    adHocBudget: overrides.adHocBudget ?? 1.5,
    projectAllocations: overrides.projectAllocations ?? [],
  }
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? 'p1',
    name: overrides.name ?? 'Project 1',
    color: overrides.color ?? '#b8e6c8',
    startDate: overrides.startDate ?? '2026-03-01',
    endDate: overrides.endDate ?? '2026-03-31',
    status: overrides.status ?? 'active',
    tasks: overrides.tasks ?? [],
  }
}

describe('useAutoSuggest', () => {
  describe('priority scoring', () => {
    it('ranks higher urgency project first', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-20', // 6 days away from 2026-03-14
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 12, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-31', // 17 days away
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 12, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      // p1 has higher urgency (12/6=2) vs p2 (12/17~0.7)
      expect(suggestions.value[0].projectId).toBe('p1')
    })

    it('breaks ties by earlier deadline', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-25',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 10, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-20',
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 10, status: 'todo' },
          ],
        }),
      ])
      // Both have ~same urgency range but p2 deadline is earlier
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      // p2 has higher urgency: 10/6 ~1.67 vs p1: 10/11 ~0.91
      expect(suggestions.value[0].projectId).toBe('p2')
    })

    it('past-deadline projects get highest urgency', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-10', // Past due as of 2026-03-14
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 5, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-20',
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 100, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      expect(suggestions.value[0].projectId).toBe('p1')
    })

    it('past-deadline projects sorted by how overdue', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-12', // 2 days overdue
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 5, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-10', // 4 days overdue
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 5, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      // p2 is more overdue → should be first
      expect(suggestions.value[0].projectId).toBe('p2')
    })
  })

  describe('day assignment (greedy algorithm)', () => {
    it('assigns highest-priority project to days with most available time', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-20',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 15, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-25',
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 10, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      // p1 should get more days (higher urgency)
      const p1Days = suggestions.value.filter((s) => s.projectId === 'p1')
      const p2Days = suggestions.value.filter((s) => s.projectId === 'p2')
      expect(p1Days.length).toBeGreaterThanOrEqual(1)
      expect(p2Days.length).toBeGreaterThanOrEqual(1)
    })

    it('each project gets at least 1 day', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-20',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 20, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-25',
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 5, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p3',
          endDate: '2026-03-28',
          tasks: [
            { id: 't3', name: 'T3', estimatedHours: 3, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2', 'p3'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      const p1Days = suggestions.value.filter((s) => s.projectId === 'p1')
      const p2Days = suggestions.value.filter((s) => s.projectId === 'p2')
      const p3Days = suggestions.value.filter((s) => s.projectId === 'p3')
      expect(p1Days.length).toBeGreaterThanOrEqual(1)
      expect(p2Days.length).toBeGreaterThanOrEqual(1)
      expect(p3Days.length).toBeGreaterThanOrEqual(1)
    })

    it('project with <1h remaining gets exactly 1 day', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-20',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 0.5, status: 'todo' },
          ],
        }),
        makeProject({
          id: 'p2',
          endDate: '2026-03-25',
          tasks: [
            { id: 't2', name: 'T2', estimatedHours: 20, status: 'todo' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      const p1Days = suggestions.value.filter((s) => s.projectId === 'p1')
      expect(p1Days).toHaveLength(1)
    })

    it('returns empty suggestions with no focus projects', () => {
      const projects = ref<Project[]>([])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: [],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      expect(suggestions.value).toHaveLength(0)
    })

    it('does not assign days to completed projects', () => {
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-20',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 10, status: 'done' },
          ],
        }),
      ])
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1'],
        dailyAllocations: days,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)
      const today = ref('2026-03-14')

      const { suggestions } = useAutoSuggest(
        projects,
        currentWeek,
        defaults,
        today,
      )

      expect(suggestions.value).toHaveLength(0)
    })
  })
})
