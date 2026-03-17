import { computed, type Ref } from 'vue'
import type { Project, WeekPlan, DayDefaults, Meeting } from '../types'
import { calculateAvailableTime } from '../utils/timemath'

export type AlertLevel = 'blocking' | 'warning' | 'suggestion' | 'healthy'

export interface OvercommitAlert {
  level: AlertLevel
  message: string
}

/**
 * Parse an ISO-ish datetime string and return fractional hours since midnight.
 * Extracts hours/minutes directly from string to avoid timezone issues.
 */
function datetimeToHours(dt: string): number {
  const tIdx = dt.indexOf('T')
  if (tIdx === -1) return 0
  const timePart = dt.slice(tIdx + 1)
  const match = timePart.match(/^(\d{2}):(\d{2})/)
  if (!match) return 0
  return Number(match[1]) + Number(match[2]) / 60
}

function totalMeetingHoursForWeek(wp: WeekPlan): number {
  let total = 0
  for (const day of wp.dailyAllocations) {
    for (const m of day.meetings) {
      const start = datetimeToHours(m.start)
      const end = datetimeToHours(m.end)
      total += end - start
    }
  }
  return total
}

function dayAvailableTime(meetings: Meeting[], defaults: DayDefaults): number {
  return calculateAvailableTime(meetings, defaults)
}

/**
 * Detect overcommit conditions and produce alerts.
 *
 * 4 levels:
 * 1. blocking — 4th focus project attempted
 * 2. warning — remaining work exceeds available hours
 * 3. suggestion — deadline at risk, concrete fix proposals
 * 4. healthy — no issues
 *
 * Aggressive protections:
 * - Meeting creep: meetings increase >20% vs previous week
 * - Focus time defender: day with <2h project time
 * - Deadline countdown: project in final week with >50% tasks remaining
 */
export function useOvercommit(
  focusProjects: Ref<string[]>,
  projects: Ref<Project[]>,
  currentWeek: Ref<WeekPlan>,
  previousWeek: Ref<WeekPlan | null>,
  defaults: Ref<DayDefaults>,
) {
  const alerts = computed<OvercommitAlert[]>(() => {
    const result: OvercommitAlert[] = []

    // --- Blocking: 4th focus project ---
    if (focusProjects.value.length > 3) {
      result.push({
        level: 'blocking',
        message:
          'Too many focus projects (max 3). Replace or delay one before adding another.',
      })
    }

    // --- Warning: overcommit ---
    const totalAvailable = currentWeek.value.dailyAllocations.reduce(
      (sum, day) => {
        const dayDef: DayDefaults = {
          ...defaults.value,
          overhead: day.overhead,
          adHocBudget: day.adHocBudget,
        }
        return sum + dayAvailableTime(day.meetings, dayDef)
      },
      0,
    )

    const focusProjectObjs = projects.value.filter((p) =>
      focusProjects.value.includes(p.id),
    )

    const totalRemainingWork = focusProjectObjs.reduce((sum, p) => {
      const remaining = p.tasks
        .filter((t) => t.status !== 'done')
        .reduce((s, t) => s + t.estimatedHours, 0)
      return sum + remaining
    }, 0)

    if (totalRemainingWork > totalAvailable && totalRemainingWork > 0) {
      result.push({
        level: 'warning',
        message: `Estimated remaining work (${totalRemainingWork}h) exceeds available hours this week (${totalAvailable.toFixed(1)}h).`,
      })
    }

    // --- Suggestion: deadline at risk ---
    const weekStartDate = new Date(currentWeek.value.weekStart + 'T12:00:00Z')
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 4) // Friday of the week

    for (const project of focusProjectObjs) {
      const deadline = new Date(project.endDate + 'T12:00:00Z')
      const isInFinalWeek =
        deadline >= weekStartDate && deadline <= weekEndDate

      if (isInFinalWeek) {
        const totalTasks = project.tasks.length
        const doneTasks = project.tasks.filter((t) => t.status === 'done').length
        const remainingRatio = totalTasks > 0 ? (totalTasks - doneTasks) / totalTasks : 0

        if (remainingRatio > 0.5) {
          // Deadline countdown: urgent
          result.push({
            level: 'suggestion',
            message: `Deadline urgent: "${project.name}" is in its final week with ${Math.round(remainingRatio * 100)}% tasks remaining. Consider reducing scope or extending the deadline.`,
          })
        }
      }
    }

    // --- Meeting creep alert ---
    if (previousWeek.value !== null) {
      const prevHours = totalMeetingHoursForWeek(previousWeek.value)
      const curHours = totalMeetingHoursForWeek(currentWeek.value)

      // Compare against 0 if previous week had no meetings
      const threshold = prevHours === 0 ? 0 : prevHours * 0.2

      if (curHours > prevHours + threshold && curHours > 0) {
        const pctIncrease =
          prevHours === 0
            ? 'from 0h'
            : `${Math.round(((curHours - prevHours) / prevHours) * 100)}%`
        result.push({
          level: 'warning',
          message: `Meeting creep: meetings increased ${pctIncrease} vs previous week (${prevHours.toFixed(1)}h -> ${curHours.toFixed(1)}h).`,
        })
      }
    }

    // --- Focus time defender ---
    for (const day of currentWeek.value.dailyAllocations) {
      const dayDef: DayDefaults = {
        ...defaults.value,
        overhead: day.overhead,
        adHocBudget: day.adHocBudget,
      }
      const available = dayAvailableTime(day.meetings, dayDef)
      if (available < 2) {
        result.push({
          level: 'warning',
          message: `Low focus time on ${day.date}: only ${available.toFixed(1)}h of project time available.`,
        })
      }
    }

    return result
  })

  const status = computed<AlertLevel>(() => {
    if (alerts.value.some((a) => a.level === 'blocking')) return 'blocking'
    if (alerts.value.some((a) => a.level === 'warning')) return 'warning'
    if (alerts.value.some((a) => a.level === 'suggestion')) return 'suggestion'
    return 'healthy'
  })

  return { alerts, status }
}
