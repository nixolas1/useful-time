import { describe, it, expect } from 'vitest'
import {
  calculateAvailableTime,
  mergeBuffers,
  clipBuffersToWorkday,
  reduceAllocationsProportionally,
} from '../timemath'
import type { Meeting, DayDefaults } from '../../types'

const defaults: DayDefaults = {
  workHours: 8,
  workdayStart: '09:00',
  overhead: 1.5,
  adHocBudget: 1.5,
  meetingBuffer: 0.25,
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

describe('calculateAvailableTime', () => {
  it('returns full available time when no meetings', () => {
    // Available = 8 - 1.5 - 1.5 - 0 = 5
    const result = calculateAvailableTime([], defaults)
    expect(result).toBe(5)
  })

  it('subtracts meeting hours and buffers', () => {
    const meetings = [
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T11:00' }),
    ]
    // meetingHours = 1, bufferHours = 0.5 (0.25 before + 0.25 after)
    // Available = 8 - 1.5 - 1.5 - (1 + 0.5) = 3.5
    const result = calculateAvailableTime(meetings, defaults)
    expect(result).toBe(3.5)
  })

  it('merges buffers for back-to-back meetings', () => {
    const meetings = [
      makeMeeting({ id: 'a', start: '2026-03-14T10:00', end: '2026-03-14T10:30' }),
      makeMeeting({ id: 'b', start: '2026-03-14T10:30', end: '2026-03-14T11:00' }),
    ]
    // Meeting hours = 0.5 + 0.5 = 1
    // Buffers: A.before=0.25, merged gap=0.25 (single gap), B.after=0.25 => total 0.75
    // Available = 8 - 1.5 - 1.5 - (1 + 0.75) = 3.25
    const result = calculateAvailableTime(meetings, defaults)
    expect(result).toBe(3.25)
  })

  it('clips buffers to workday boundaries', () => {
    // Meeting right at workday start
    const meetings = [
      makeMeeting({ start: '2026-03-14T09:00', end: '2026-03-14T09:30' }),
    ]
    // bufferBefore would be 09:00 - 0.25 = 08:45, clipped to 09:00 => 0
    // bufferAfter = 0.25
    // meetingHours = 0.5, bufferHours = 0 + 0.25 = 0.25
    // Available = 8 - 1.5 - 1.5 - (0.5 + 0.25) = 4.25
    const result = calculateAvailableTime(meetings, defaults)
    expect(result).toBe(4.25)
  })

  it('never returns negative available time', () => {
    // Many meetings filling the day
    const meetings = [
      makeMeeting({ id: 'a', start: '2026-03-14T09:00', end: '2026-03-14T12:00' }),
      makeMeeting({ id: 'b', start: '2026-03-14T13:00', end: '2026-03-14T17:00' }),
    ]
    // meetingHours = 3 + 4 = 7, plus buffers
    // Available should be clamped to 0
    const result = calculateAvailableTime(meetings, defaults)
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('uses custom overhead and adHocBudget', () => {
    const custom: DayDefaults = { ...defaults, overhead: 0, adHocBudget: 0 }
    const result = calculateAvailableTime([], custom)
    expect(result).toBe(8)
  })
})

describe('mergeBuffers', () => {
  it('returns individual buffers for isolated meetings', () => {
    const meetings = [
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T10:30' }),
      makeMeeting({ id: 'b', start: '2026-03-14T14:00', end: '2026-03-14T14:30' }),
    ]
    const result = mergeBuffers(meetings)
    // Two separate meetings: each gets bufferBefore + bufferAfter
    expect(result).toBe(1) // 0.25*4
  })

  it('merges buffers for back-to-back meetings', () => {
    const meetings = [
      makeMeeting({ id: 'a', start: '2026-03-14T10:00', end: '2026-03-14T10:30' }),
      makeMeeting({ id: 'b', start: '2026-03-14T10:30', end: '2026-03-14T11:00' }),
    ]
    // A.before=0.25, gap between A and B = 0min, merged buffer = max(A.after, B.before)=0.25, B.after=0.25
    // total = 0.25 + 0.25 + 0.25 = 0.75
    const result = mergeBuffers(meetings)
    expect(result).toBe(0.75)
  })

  it('merges buffers for overlapping meetings', () => {
    const meetings = [
      makeMeeting({ id: 'a', start: '2026-03-14T10:00', end: '2026-03-14T10:45' }),
      makeMeeting({ id: 'b', start: '2026-03-14T10:30', end: '2026-03-14T11:00' }),
    ]
    // Overlapping: merged buffer gap = max(A.after, B.before) = 0.25
    const result = mergeBuffers(meetings)
    expect(result).toBe(0.75) // 0.25 + 0.25 + 0.25
  })

  it('returns 0 for empty meetings', () => {
    expect(mergeBuffers([])).toBe(0)
  })

  it('handles single meeting', () => {
    const meetings = [
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T10:30' }),
    ]
    expect(mergeBuffers(meetings)).toBe(0.5) // 0.25 + 0.25
  })
})

describe('clipBuffersToWorkday', () => {
  it('clips buffer before workday start', () => {
    const meetings = [
      makeMeeting({ start: '2026-03-14T09:00', end: '2026-03-14T09:30', bufferBefore: 0.25 }),
    ]
    // bufferBefore at 09:00 goes to 08:45, clipped to 09:00 → effective bufferBefore=0
    const result = clipBuffersToWorkday(meetings, defaults)
    expect(result[0].bufferBefore).toBe(0)
    expect(result[0].bufferAfter).toBe(0.25)
  })

  it('clips buffer after workday end', () => {
    // workday: 09:00 + 8h = 17:00
    const meetings = [
      makeMeeting({ start: '2026-03-14T16:30', end: '2026-03-14T17:00', bufferAfter: 0.5 }),
    ]
    // bufferAfter at 17:00 goes to 17:30, clipped to 17:00 → effective bufferAfter=0
    const result = clipBuffersToWorkday(meetings, defaults)
    expect(result[0].bufferAfter).toBe(0)
  })

  it('does not clip buffers within workday', () => {
    const meetings = [
      makeMeeting({ start: '2026-03-14T12:00', end: '2026-03-14T13:00' }),
    ]
    const result = clipBuffersToWorkday(meetings, defaults)
    expect(result[0].bufferBefore).toBe(0.25)
    expect(result[0].bufferAfter).toBe(0.25)
  })

  it('partially clips buffer that extends past boundary', () => {
    const meetings = [
      makeMeeting({
        start: '2026-03-14T09:10',
        end: '2026-03-14T09:30',
        bufferBefore: 0.25, // 15min before 09:10 = 08:55, clips to 09:00 → 10min = 10/60
      }),
    ]
    const result = clipBuffersToWorkday(meetings, defaults)
    expect(result[0].bufferBefore).toBeCloseTo(10 / 60, 5)
  })

  it('handles empty meetings', () => {
    expect(clipBuffersToWorkday([], defaults)).toEqual([])
  })
})

describe('reduceAllocationsProportionally', () => {
  it('reduces allocations proportionally to fit new total', () => {
    const allocations = [
      { projectId: 'a', hours: 3, priority: 1 },
      { projectId: 'b', hours: 2, priority: 2 },
    ]
    // Total = 5, new total = 3
    const result = reduceAllocationsProportionally(allocations, 3)
    const total = result.reduce((sum, a) => sum + a.hours, 0)
    expect(total).toBe(3)
  })

  it('rounds to nearest 15 minutes', () => {
    const allocations = [
      { projectId: 'a', hours: 3, priority: 1 },
      { projectId: 'b', hours: 2, priority: 2 },
    ]
    const result = reduceAllocationsProportionally(allocations, 3)
    result.forEach((a) => {
      // hours should be multiple of 0.25
      expect(a.hours * 4).toBe(Math.round(a.hours * 4))
    })
  })

  it('assigns rounding residual to highest-priority project', () => {
    const allocations = [
      { projectId: 'a', hours: 3, priority: 2 },
      { projectId: 'b', hours: 2, priority: 1 }, // higher priority (lower number)
    ]
    const result = reduceAllocationsProportionally(allocations, 2.5)
    const total = result.reduce((sum, a) => sum + a.hours, 0)
    expect(total).toBe(2.5)
    // All should be multiples of 0.25
    result.forEach((a) => {
      expect(a.hours * 4).toBe(Math.round(a.hours * 4))
    })
  })

  it('returns empty for empty allocations', () => {
    expect(reduceAllocationsProportionally([], 5)).toEqual([])
  })

  it('does not increase allocations when new total is larger', () => {
    const allocations = [
      { projectId: 'a', hours: 2, priority: 1 },
      { projectId: 'b', hours: 1, priority: 2 },
    ]
    // newTotal=5 > current 3 → keep original
    const result = reduceAllocationsProportionally(allocations, 5)
    expect(result).toEqual([
      { projectId: 'a', hours: 2 },
      { projectId: 'b', hours: 1 },
    ])
  })

  it('handles zero new total', () => {
    const allocations = [
      { projectId: 'a', hours: 3, priority: 1 },
    ]
    const result = reduceAllocationsProportionally(allocations, 0)
    expect(result).toEqual([{ projectId: 'a', hours: 0 }])
  })

  it('handles single project', () => {
    const allocations = [
      { projectId: 'a', hours: 4, priority: 1 },
    ]
    const result = reduceAllocationsProportionally(allocations, 2.5)
    expect(result).toEqual([{ projectId: 'a', hours: 2.5 }])
  })
})
