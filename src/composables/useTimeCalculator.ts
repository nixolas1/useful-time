import { computed, type Ref } from 'vue'
import type { Meeting, DayDefaults } from '../types'
import {
  calculateAvailableTime,
  mergeBuffers,
  clipBuffersToWorkday,
} from '../utils/timemath'

/**
 * Parse an ISO-ish datetime string and return fractional hours since midnight.
 * Extracts hours/minutes directly from string to avoid timezone issues.
 */
function parseTimeFromDatetime(dt: string): number {
  const tIdx = dt.indexOf('T')
  if (tIdx === -1) return 0
  const timePart = dt.slice(tIdx + 1)
  const match = timePart.match(/^(\d{2}):(\d{2})/)
  if (!match) return 0
  return Number(match[1]) + Number(match[2]) / 60
}

/**
 * Reactive wrapper around timemath calculations.
 * Zero D3 dependencies.
 *
 * Accepts refs for meetings, overhead, adHocBudget, and dayDefaults.
 * The overhead and adHocBudget refs override what is in dayDefaults
 * so that per-day adjustments are reactive.
 */
export function useTimeCalculator(
  meetings: Ref<Meeting[]>,
  overhead: Ref<number>,
  adHocBudget: Ref<number>,
  dayDefaults: Ref<DayDefaults>,
) {
  const effectiveDefaults = computed<DayDefaults>(() => ({
    ...dayDefaults.value,
    overhead: overhead.value,
    adHocBudget: adHocBudget.value,
  }))

  const clippedMeetings = computed(() =>
    clipBuffersToWorkday(meetings.value, effectiveDefaults.value),
  )

  const meetingHours = computed(() => {
    const mtgs = clippedMeetings.value
    if (mtgs.length === 0) return 0
    const sorted = [...mtgs].sort(
      (a, b) => parseTimeFromDatetime(a.start) - parseTimeFromDatetime(b.start),
    )
    let total = 0
    let currentEnd = -Infinity
    for (const m of sorted) {
      const startH = parseTimeFromDatetime(m.start)
      const endH = parseTimeFromDatetime(m.end)
      if (startH >= currentEnd) {
        total += endH - startH
        currentEnd = endH
      } else if (endH > currentEnd) {
        total += endH - currentEnd
        currentEnd = endH
      }
    }
    return total
  })

  const bufferHours = computed(() =>
    mergeBuffers(clippedMeetings.value),
  )

  const availableProjectTime = computed(() =>
    calculateAvailableTime(meetings.value, effectiveDefaults.value),
  )

  return {
    availableProjectTime,
    meetingHours,
    bufferHours,
  }
}
