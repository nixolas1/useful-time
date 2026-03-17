import type { Meeting, DayDefaults } from '../types'

/**
 * Parse a time string "HH:MM" into fractional hours since midnight.
 */
function parseTimeToHours(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h + m / 60
}

/**
 * Parse an ISO-ish datetime string and return fractional hours since midnight.
 * Handles formats like "2026-03-14T10:00", "2026-03-14T10:00:00", "2026-03-14T10:00:00Z".
 * Extracts hours/minutes directly from the string to avoid timezone issues.
 */
function datetimeToHours(dt: string): number {
  // Find the T separator and extract HH:MM after it
  const tIdx = dt.indexOf('T')
  if (tIdx === -1) return 0
  const timePart = dt.slice(tIdx + 1)
  const match = timePart.match(/^(\d{2}):(\d{2})/)
  if (!match) return 0
  return Number(match[1]) + Number(match[2]) / 60
}

/**
 * Calculate total meeting hours from a list of meetings.
 * Overlapping meetings are merged so time is not double-counted.
 */
function totalMeetingHours(meetings: Meeting[]): number {
  if (meetings.length === 0) return 0
  const sorted = [...meetings].sort(
    (a, b) => datetimeToHours(a.start) - datetimeToHours(b.start),
  )
  let total = 0
  let currentEnd = -Infinity
  for (const m of sorted) {
    const start = datetimeToHours(m.start)
    const end = datetimeToHours(m.end)
    if (start >= currentEnd) {
      total += end - start
      currentEnd = end
    } else if (end > currentEnd) {
      total += end - currentEnd
      currentEnd = end
    }
  }
  return total
}

/**
 * Clip meeting buffers to workday boundaries.
 * Returns new meetings with adjusted bufferBefore/bufferAfter.
 */
export function clipBuffersToWorkday(
  meetings: Meeting[],
  defaults: DayDefaults,
): Meeting[] {
  const workStart = parseTimeToHours(defaults.workdayStart)
  const workEnd = workStart + defaults.workHours

  return meetings.map((m) => {
    const meetStart = datetimeToHours(m.start)
    const meetEnd = datetimeToHours(m.end)

    // Buffer before: starts at meetStart - bufferBefore, clip to workStart
    const bufferBeforeStart = meetStart - m.bufferBefore
    const clippedBeforeStart = Math.max(bufferBeforeStart, workStart)
    const clippedBefore = Math.max(meetStart - clippedBeforeStart, 0)

    // Buffer after: ends at meetEnd + bufferAfter, clip to workEnd
    const bufferAfterEnd = meetEnd + m.bufferAfter
    const clippedAfterEnd = Math.min(bufferAfterEnd, workEnd)
    const clippedAfter = Math.max(clippedAfterEnd - meetEnd, 0)

    return {
      ...m,
      bufferBefore: clippedBefore,
      bufferAfter: clippedAfter,
    }
  })
}

/**
 * Calculate total buffer hours after merging adjacent/overlapping meeting buffers.
 *
 * When meetings are back-to-back or overlapping, the after-buffer of the first
 * and the before-buffer of the second collapse into a single gap equal to
 * max(first.bufferAfter, second.bufferBefore).
 */
export function mergeBuffers(meetings: Meeting[]): number {
  if (meetings.length === 0) return 0

  const sorted = [...meetings].sort(
    (a, b) => datetimeToHours(a.start) - datetimeToHours(b.start),
  )

  // First meeting's bufferBefore
  let total = sorted[0].bufferBefore

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i]
    const next = sorted[i + 1]
    const currentEnd = datetimeToHours(current.end)
    const nextStart = datetimeToHours(next.start)
    const gap = nextStart - currentEnd

    if (gap <= 0) {
      // Back-to-back or overlapping: merge buffers into single gap
      total += Math.max(current.bufferAfter, next.bufferBefore)
    } else {
      // Separated: each gets its own buffer
      total += current.bufferAfter + next.bufferBefore
    }
  }

  // Last meeting's bufferAfter
  total += sorted[sorted.length - 1].bufferAfter

  return total
}

/**
 * Available Project Time = workHours - overhead - adHocBudget - (meetingHours + bufferHours)
 *
 * Buffers are merged for adjacent meetings and clipped to workday boundaries.
 * Result is clamped to >= 0.
 */
export function calculateAvailableTime(
  meetings: Meeting[],
  defaults: DayDefaults,
): number {
  const clipped = clipBuffersToWorkday(meetings, defaults)
  const meetingHours = totalMeetingHours(clipped)
  const bufferHours = mergeBuffers(clipped)

  const available =
    defaults.workHours -
    defaults.overhead -
    defaults.adHocBudget -
    (meetingHours + bufferHours)

  return Math.max(available, 0)
}

/**
 * Round a number to the nearest 0.25 (15 minutes).
 */
function roundTo15(n: number): number {
  return Math.round(n * 4) / 4
}

/**
 * Reduce project allocations proportionally to fit a new total.
 * Rounds each to nearest 15 minutes; rounding residual is assigned
 * to the highest-priority project (lowest priority number).
 *
 * If newTotal >= current total, returns original allocations unchanged.
 */
export function reduceAllocationsProportionally(
  allocations: { projectId: string; hours: number; priority: number }[],
  newTotal: number,
): { projectId: string; hours: number }[] {
  if (allocations.length === 0) return []

  const currentTotal = allocations.reduce((sum, a) => sum + a.hours, 0)

  if (currentTotal <= 0 || newTotal >= currentTotal) {
    return allocations.map(({ projectId, hours }) => ({ projectId, hours }))
  }

  if (newTotal <= 0) {
    return allocations.map(({ projectId }) => ({ projectId, hours: 0 }))
  }

  const ratio = newTotal / currentTotal

  // Round each proportionally
  const result = allocations.map((a) => ({
    projectId: a.projectId,
    hours: roundTo15(a.hours * ratio),
    priority: a.priority,
  }))

  // Fix rounding residual
  const roundedTotal = result.reduce((sum, a) => sum + a.hours, 0)
  const residual = roundTo15(newTotal - roundedTotal)

  if (Math.abs(residual) > 0.001) {
    // Find highest priority (lowest number)
    const sorted = [...result].sort((a, b) => a.priority - b.priority)
    const target = sorted[0]
    const idx = result.findIndex((r) => r.projectId === target.projectId)
    result[idx].hours = roundTo15(result[idx].hours + residual)
    // Clamp to non-negative
    result[idx].hours = Math.max(result[idx].hours, 0)
  }

  return result.map(({ projectId, hours }) => ({ projectId, hours }))
}
