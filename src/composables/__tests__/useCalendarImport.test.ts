import { describe, it, expect, beforeEach } from 'vitest'
import { useCalendarImport } from '../useCalendarImport'
import { useWeekPlan } from '../useWeekPlan'
import type { StorageAdapter, DayDefaults } from '../../types'
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

const singleEventICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-001
SUMMARY:Team Standup
DTSTART:20260309T100000
DTEND:20260309T103000
END:VEVENT
END:VCALENDAR`

const twoEventsICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-001
SUMMARY:Team Standup
DTSTART:20260309T100000
DTEND:20260309T103000
END:VEVENT
BEGIN:VEVENT
UID:evt-002
SUMMARY:Design Review
DTSTART:20260310T140000
DTEND:20260310T150000
END:VEVENT
END:VCALENDAR`

const duplicateEventICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-001
SUMMARY:Updated Standup
DTSTART:20260309T110000
DTEND:20260309T113000
END:VEVENT
END:VCALENDAR`

const outsideWeekICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:evt-999
SUMMARY:Weekend event
DTSTART:20260315T100000
DTEND:20260315T110000
END:VEVENT
END:VCALENDAR`

describe('useCalendarImport', () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = createMockStorage()
    storage.set<DayDefaults>('dayDefaults', DEFAULT_DAY_DEFAULTS)
  })

  it('imports a single meeting into the correct day', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    const stats = importICS(singleEventICS, '2026-03-09', DEFAULT_DAY_DEFAULTS.meetingBuffer)

    expect(stats.imported).toBe(1)
    expect(stats.skipped).toBe(0)
    expect(stats.updated).toBe(0)

    const wp = weekPlan.getWeekPlan('2026-03-09')!
    const monday = wp.dailyAllocations[0]
    expect(monday.meetings).toHaveLength(1)
    expect(monday.meetings[0].title).toBe('Team Standup')
    expect(monday.meetings[0].id).toBe('evt-001')
  })

  it('imports multiple meetings into correct days', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    const stats = importICS(twoEventsICS, '2026-03-09', DEFAULT_DAY_DEFAULTS.meetingBuffer)

    expect(stats.imported).toBe(2)
    const wp = weekPlan.getWeekPlan('2026-03-09')!
    expect(wp.dailyAllocations[0].meetings).toHaveLength(1) // Monday
    expect(wp.dailyAllocations[1].meetings).toHaveLength(1) // Tuesday
  })

  it('updates existing meetings with same UID', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    importICS(singleEventICS, '2026-03-09', DEFAULT_DAY_DEFAULTS.meetingBuffer)

    // Import again with updated time/title
    const stats = importICS(duplicateEventICS, '2026-03-09', DEFAULT_DAY_DEFAULTS.meetingBuffer)

    expect(stats.updated).toBe(1)
    expect(stats.imported).toBe(0)

    const wp = weekPlan.getWeekPlan('2026-03-09')!
    const monday = wp.dailyAllocations[0]
    expect(monday.meetings).toHaveLength(1)
    expect(monday.meetings[0].title).toBe('Updated Standup')
  })

  it('skips events outside the week', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    const stats = importICS(outsideWeekICS, '2026-03-09', DEFAULT_DAY_DEFAULTS.meetingBuffer)

    expect(stats.skipped).toBe(1)
    expect(stats.imported).toBe(0)
  })

  it('applies buffer settings to imported meetings', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    importICS(singleEventICS, '2026-03-09', 0.5)

    const wp = weekPlan.getWeekPlan('2026-03-09')!
    const meeting = wp.dailyAllocations[0].meetings[0]
    expect(meeting.bufferBefore).toBe(0.5)
    expect(meeting.bufferAfter).toBe(0.5)
  })

  it('returns correct combined stats', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)

    // First import: 2 new
    const stats1 = importICS(twoEventsICS, '2026-03-09', 0.25)
    expect(stats1.imported).toBe(2)
    expect(stats1.updated).toBe(0)
    expect(stats1.skipped).toBe(0)

    // Second import: 1 update (same UID as evt-001)
    const stats2 = importICS(duplicateEventICS, '2026-03-09', 0.25)
    expect(stats2.imported).toBe(0)
    expect(stats2.updated).toBe(1)
    expect(stats2.skipped).toBe(0)
  })

  it('handles empty ICS content', () => {
    const weekPlan = useWeekPlan(storage)
    weekPlan.createWeekPlan('2026-03-09')

    const { importICS } = useCalendarImport(storage, weekPlan)
    const stats = importICS('', '2026-03-09', 0.25)

    expect(stats.imported).toBe(0)
    expect(stats.skipped).toBe(0)
    expect(stats.updated).toBe(0)
  })
})
