import { readData, getMonday, parseArgs } from './lib/data'
import type { DayAllocation } from '../src/types/index'
import { DEFAULT_DAY_DEFAULTS } from '../src/types/index'

const args = parseArgs(process.argv)
const weekStart = getMonday(args['week'])

const data = readData()
const defaults = data.dayDefaults ?? { ...DEFAULT_DAY_DEFAULTS }

const weekPlan = data.weekPlans.find((w) => w.weekStart === weekStart)

type Level = 'healthy' | 'warning' | 'blocking' | 'suggestion'

const warnings: string[] = []
const suggestions: string[] = []
let level: Level = 'healthy'

function setLevel(newLevel: Level): void {
  const priority: Record<Level, number> = {
    healthy: 0,
    suggestion: 1,
    warning: 2,
    blocking: 3,
  }
  if (priority[newLevel] > priority[level]) {
    level = newLevel
  }
}

if (!weekPlan || weekPlan.dailyAllocations.length === 0) {
  suggestions.push(
    `No plan found for week ${weekStart}. Consider creating one.`
  )
  setLevel('suggestion')
} else {
  const workdaysInWeek = 5 // Mon-Fri
  const totalCapacity = defaults.workHours * workdaysInWeek

  let totalMeetingHours = 0
  let totalProjectHours = 0
  let totalOverhead = 0
  let totalAdHoc = 0
  let overcommittedDays = 0

  for (const day of weekPlan.dailyAllocations) {
    const meetingHours = getMeetingHours(day)
    const projectHours = day.projectAllocations.reduce(
      (sum, a) => sum + a.hours,
      0
    )
    const overhead = day.overhead
    const adHoc = day.adHocBudget

    totalMeetingHours += meetingHours
    totalProjectHours += projectHours
    totalOverhead += overhead
    totalAdHoc += adHoc

    const totalUsed = meetingHours + projectHours + adHoc + overhead
    const available = defaults.workHours - overhead - adHoc - meetingHours
    const bufferHours = getMeetingBufferHours(day)

    if (totalUsed > defaults.workHours) {
      warnings.push(
        `${day.date}: overcommitted by ${(totalUsed - defaults.workHours).toFixed(1)}h`
      )
      overcommittedDays++
      setLevel('warning')
    }

    // Check meeting creep: meetings consuming > 60% of work hours
    if (meetingHours + bufferHours > defaults.workHours * 0.6) {
      warnings.push(
        `${day.date}: meetings + buffers consume ${((meetingHours + bufferHours) / defaults.workHours * 100).toFixed(0)}% of the day`
      )
      setLevel('warning')
    }

    // Check focus time: available blocks < 2h
    if (available < 2 && available > 0) {
      suggestions.push(
        `${day.date}: only ${available.toFixed(1)}h available for project work (focus time may be fragmented)`
      )
      setLevel('suggestion')
    }

    if (available <= 0) {
      warnings.push(
        `${day.date}: no time available for project work`
      )
      setLevel('blocking')
    }
  }

  // Weekly-level checks
  const totalUsedWeekly =
    totalMeetingHours + totalProjectHours + totalOverhead + totalAdHoc
  if (totalUsedWeekly > totalCapacity) {
    warnings.push(
      `Weekly total: ${totalUsedWeekly.toFixed(1)}h committed vs ${totalCapacity}h capacity`
    )
    setLevel('blocking')
  }

  // Check if focus projects have allocations
  if (weekPlan.focusProjects.length > 0) {
    const allocatedProjectIds = new Set<string>()
    for (const day of weekPlan.dailyAllocations) {
      for (const alloc of day.projectAllocations) {
        if (alloc.hours > 0) {
          allocatedProjectIds.add(alloc.projectId)
        }
      }
    }
    for (const focusId of weekPlan.focusProjects) {
      if (!allocatedProjectIds.has(focusId)) {
        const project = data.projects.find((p) => p.id === focusId)
        const name = project?.name ?? focusId
        suggestions.push(
          `Focus project "${name}" has no time allocated this week`
        )
        setLevel('suggestion')
      }
    }
  }

  // Check deadline proximity
  const weekEnd = new Date(weekStart + 'T00:00:00')
  weekEnd.setDate(weekEnd.getDate() + 6)
  for (const project of data.projects) {
    if (project.status !== 'active') continue
    const endDate = new Date(project.endDate + 'T00:00:00')
    const daysUntilDeadline = Math.ceil(
      (endDate.getTime() - new Date(weekStart + 'T00:00:00').getTime()) /
        (1000 * 60 * 60 * 24)
    )
    if (daysUntilDeadline <= 7 && daysUntilDeadline >= 0) {
      const remainingTasks = project.tasks.filter((t) => t.status !== 'done')
      const remainingHours = remainingTasks.reduce(
        (sum, t) => sum + t.estimatedHours,
        0
      )
      if (remainingHours > 0) {
        warnings.push(
          `Project "${project.name}" deadline in ${daysUntilDeadline} days with ${remainingHours}h of work remaining`
        )
        setLevel('warning')
      }
    }
  }

  if (overcommittedDays >= 3) {
    setLevel('blocking')
  }
}

function getMeetingHours(day: DayAllocation): number {
  return day.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60)
  }, 0)
}

function getMeetingBufferHours(day: DayAllocation): number {
  return day.meetings.reduce(
    (sum, m) => sum + m.bufferBefore + m.bufferAfter,
    0
  )
}

const output = { level, warnings, suggestions }
process.stdout.write(JSON.stringify(output, null, 2) + '\n')
process.exit(0)
