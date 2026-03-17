import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useOvercommit } from '../useOvercommit'
import type { Project, WeekPlan, DayAllocation, Meeting, DayDefaults } from '../../types'
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

function makeMeeting(overrides: Partial<Meeting> & { start: string; end: string }): Meeting {
  return {
    id: overrides.id ?? 'mtg-1',
    title: overrides.title ?? 'Meeting',
    start: overrides.start,
    end: overrides.end,
    bufferBefore: overrides.bufferBefore ?? 0.25,
    bufferAfter: overrides.bufferAfter ?? 0.25,
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

describe('useOvercommit', () => {
  describe('blocking - 4th focus project', () => {
    it('returns blocking alert when 4th focus project attempted', () => {
      const focusProjects = ref(['p1', 'p2', 'p3', 'p4'])
      const projects = ref<Project[]>([])
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2', 'p3', 'p4'],
        dailyAllocations: [makeDay()],
      })
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const blocking = alerts.value.filter((a) => a.level === 'blocking')
      expect(blocking.length).toBeGreaterThanOrEqual(1)
      expect(blocking[0].message).toMatch(/focus|replace|delay/i)
    })

    it('no blocking alert with 3 or fewer focus projects', () => {
      const focusProjects = ref(['p1', 'p2'])
      const projects = ref<Project[]>([])
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1', 'p2'],
        dailyAllocations: [makeDay()],
      })
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const blocking = alerts.value.filter((a) => a.level === 'blocking')
      expect(blocking).toHaveLength(0)
    })
  })

  describe('warning - overcommit detection', () => {
    it('warns when estimated work exceeds available hours', () => {
      const focusProjects = ref(['p1'])
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          tasks: [
            { id: 't1', name: 'Task 1', estimatedHours: 30, status: 'todo' },
          ],
        }),
      ])
      // 5 days, each with 5h available = 25h total
      const days = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${9 + i}` }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: ['p1'],
        dailyAllocations: days,
      })
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const warnings = alerts.value.filter((a) => a.level === 'warning')
      expect(warnings.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('suggestion - deadline at risk', () => {
    it('suggests fix when project in final week with >50% tasks remaining', () => {
      const focusProjects = ref(['p1'])
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-13', // Ends this Friday (week of 2026-03-09)
          tasks: [
            { id: 't1', name: 'Task 1', estimatedHours: 5, status: 'todo' },
            { id: 't2', name: 'Task 2', estimatedHours: 5, status: 'todo' },
            { id: 't3', name: 'Task 3', estimatedHours: 5, status: 'done' },
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
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const suggestions = alerts.value.filter((a) => a.level === 'suggestion')
      expect(suggestions.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('healthy status', () => {
    it('returns healthy when everything looks good', () => {
      const focusProjects = ref(['p1'])
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-04-30',
          tasks: [
            { id: 't1', name: 'Task 1', estimatedHours: 2, status: 'todo' },
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
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { status } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      expect(status.value).toBe('healthy')
    })
  })

  describe('meeting creep alert', () => {
    it('alerts when meetings increase >20% vs previous week', () => {
      const focusProjects = ref<string[]>([])
      const projects = ref<Project[]>([])

      const prevDays = Array.from({ length: 5 }, (_, i) =>
        makeDay({
          date: `2026-03-0${2 + i}`,
          meetings: [
            makeMeeting({
              id: `prev-${i}`,
              start: `2026-03-0${2 + i}T10:00`,
              end: `2026-03-0${2 + i}T11:00`,
            }),
          ],
        }),
      )
      const previousWeek = ref<WeekPlan>({
        weekStart: '2026-03-02',
        focusProjects: [],
        dailyAllocations: prevDays,
      })

      // Current week: 7 meetings vs 5 = 40% increase
      const curDays = Array.from({ length: 5 }, (_, i) =>
        makeDay({
          date: `2026-03-0${9 + i}`,
          meetings:
            i < 2
              ? [
                  makeMeeting({
                    id: `cur-${i}-a`,
                    start: `2026-03-0${9 + i}T10:00`,
                    end: `2026-03-0${9 + i}T11:00`,
                  }),
                  makeMeeting({
                    id: `cur-${i}-b`,
                    start: `2026-03-0${9 + i}T14:00`,
                    end: `2026-03-0${9 + i}T15:00`,
                  }),
                ]
              : [
                  makeMeeting({
                    id: `cur-${i}`,
                    start: `2026-03-0${9 + i}T10:00`,
                    end: `2026-03-0${9 + i}T11:00`,
                  }),
                ],
        }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: [],
        dailyAllocations: curDays,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const creep = alerts.value.filter((a) => a.message.match(/meeting.*creep|meetings.*increas/i))
      expect(creep.length).toBeGreaterThanOrEqual(1)
    })

    it('is suppressed when no previous week exists', () => {
      const focusProjects = ref<string[]>([])
      const projects = ref<Project[]>([])

      const curDays = Array.from({ length: 5 }, (_, i) =>
        makeDay({
          date: `2026-03-0${9 + i}`,
          meetings: [
            makeMeeting({
              id: `cur-${i}`,
              start: `2026-03-0${9 + i}T10:00`,
              end: `2026-03-0${9 + i}T11:00`,
            }),
          ],
        }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: [],
        dailyAllocations: curDays,
      })
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const creep = alerts.value.filter((a) => a.message.match(/meeting.*creep|meetings.*increas/i))
      expect(creep).toHaveLength(0)
    })

    it('compares against 0h if previous week had no imported meetings', () => {
      const focusProjects = ref<string[]>([])
      const projects = ref<Project[]>([])

      const prevDays = Array.from({ length: 5 }, (_, i) =>
        makeDay({ date: `2026-03-0${2 + i}`, meetings: [] }),
      )
      const previousWeek = ref<WeekPlan>({
        weekStart: '2026-03-02',
        focusProjects: [],
        dailyAllocations: prevDays,
      })

      const curDays = Array.from({ length: 5 }, (_, i) =>
        makeDay({
          date: `2026-03-0${9 + i}`,
          meetings: [
            makeMeeting({
              id: `cur-${i}`,
              start: `2026-03-0${9 + i}T10:00`,
              end: `2026-03-0${9 + i}T11:00`,
            }),
          ],
        }),
      )
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: [],
        dailyAllocations: curDays,
      })
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      // Previous was 0h, current > 0h → >20% increase → creep alert
      const creep = alerts.value.filter((a) => a.message.match(/meeting.*creep|meetings.*increas/i))
      expect(creep.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('focus time defender', () => {
    it('flags day with <2h project time red', () => {
      const focusProjects = ref<string[]>([])
      const projects = ref<Project[]>([])

      // Heavy meeting day = almost no project time
      const days = [
        makeDay({
          date: '2026-03-09',
          meetings: [
            makeMeeting({
              id: 'big',
              start: '2026-03-09T09:00',
              end: '2026-03-09T16:00',
              bufferBefore: 0,
              bufferAfter: 0,
            }),
          ],
        }),
        makeDay({ date: '2026-03-10' }),
        makeDay({ date: '2026-03-11' }),
        makeDay({ date: '2026-03-12' }),
        makeDay({ date: '2026-03-13' }),
      ]
      const currentWeek = ref<WeekPlan>({
        weekStart: '2026-03-09',
        focusProjects: [],
        dailyAllocations: days,
      })
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const focusAlerts = alerts.value.filter((a) =>
        a.message.match(/focus.*time|project.*time.*low/i),
      )
      expect(focusAlerts.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('deadline countdown', () => {
    it('triggers urgent mode for project in final week with >50% tasks remaining', () => {
      const focusProjects = ref(['p1'])
      const projects = ref<Project[]>([
        makeProject({
          id: 'p1',
          endDate: '2026-03-13',
          tasks: [
            { id: 't1', name: 'T1', estimatedHours: 5, status: 'todo' },
            { id: 't2', name: 'T2', estimatedHours: 5, status: 'todo' },
            { id: 't3', name: 'T3', estimatedHours: 5, status: 'done' },
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
      const previousWeek = ref<WeekPlan | null>(null)
      const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

      const { alerts } = useOvercommit(
        focusProjects,
        projects,
        currentWeek,
        previousWeek,
        defaults,
      )

      const urgent = alerts.value.filter(
        (a) => a.message.match(/deadline|urgent|final.*week/i),
      )
      expect(urgent.length).toBeGreaterThanOrEqual(1)
    })
  })
})
