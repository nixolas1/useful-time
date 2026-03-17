import type { StorageAdapter, Meeting } from '../types'
import { parseICS } from '../utils/icsParser'
import type { useWeekPlan as UseWeekPlanType } from './useWeekPlan'

export interface ImportStats {
  imported: number
  skipped: number
  updated: number
}

/**
 * Extract the YYYY-MM-DD date portion from a datetime string.
 * Handles both ISO ("2026-03-09T10:00:00") and compact ("2026-03-09T100000") formats.
 */
function extractDate(datetime: string): string {
  return datetime.slice(0, 10)
}

export function useCalendarImport(
  _storage: StorageAdapter,
  weekPlanComposable: ReturnType<typeof UseWeekPlanType>,
) {
  function importICS(
    icsContent: string,
    weekStart: string,
    meetingBuffer: number,
  ): ImportStats {
    const stats: ImportStats = { imported: 0, skipped: 0, updated: 0 }

    const parsed = parseICS(icsContent)
    if (parsed.length === 0) return stats

    const wp = weekPlanComposable.getWeekPlan(weekStart)
    if (!wp) return stats

    const weekDates = wp.dailyAllocations.map((d) => d.date)

    // Group events by date for batch updates
    const dayMeetings = new Map<string, Meeting[]>()
    const dayUpdatedIds = new Map<string, Set<string>>()

    // Initialize from existing meetings
    for (const day of wp.dailyAllocations) {
      dayMeetings.set(day.date, [...day.meetings])
      dayUpdatedIds.set(day.date, new Set())
    }

    for (const event of parsed) {
      const eventDate = extractDate(event.start)

      if (!weekDates.includes(eventDate)) {
        stats.skipped++
        continue
      }

      const meetings = dayMeetings.get(eventDate)!
      const updatedIds = dayUpdatedIds.get(eventDate)!

      const meeting: Meeting = {
        id: event.uid,
        title: event.title,
        start: event.start,
        end: event.end,
        bufferBefore: meetingBuffer,
        bufferAfter: meetingBuffer,
      }

      const existingIdx = meetings.findIndex((m) => m.id === event.uid)

      if (existingIdx !== -1) {
        meetings[existingIdx] = meeting
        updatedIds.add(event.uid)
        stats.updated++
      } else {
        meetings.push(meeting)
        stats.imported++
      }
    }

    // Persist all modified days through the composable
    for (const day of wp.dailyAllocations) {
      const newMeetings = dayMeetings.get(day.date)!
      weekPlanComposable.updateDayAllocation(weekStart, day.date, {
        meetings: newMeetings,
      })
    }

    return stats
  }

  return { importICS }
}
