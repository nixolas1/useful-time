import { readData, getMonday, parseArgs } from './lib/data'
import type { DayAllocation, WeekPlan } from '../src/types/index'
import { DEFAULT_DAY_DEFAULTS } from '../src/types/index'

const args = parseArgs(process.argv)
const weekStart = getMonday(args['week'])

const data = readData()
const weekPlan: WeekPlan | undefined = data.weekPlans.find(
  (w) => w.weekStart === weekStart
)

if (!weekPlan) {
  process.stderr.write(`No data for week starting ${weekStart}\n`)
  process.exit(1)
}

const defaults = data.dayDefaults ?? { ...DEFAULT_DAY_DEFAULTS }

function getMeetingHours(day: DayAllocation): number {
  return day.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60)
  }, 0)
}

function getProjectHours(day: DayAllocation): number {
  return day.projectAllocations.reduce((sum, a) => sum + a.hours, 0)
}

let totalMeetingHours = 0
let totalProjectHours = 0
let totalAdHocHours = 0
const overcommitWarnings: string[] = []

const dailyBreakdown = weekPlan.dailyAllocations.map((day) => {
  const meetingHours = getMeetingHours(day)
  const projectHours = getProjectHours(day)
  const adHocHours = day.adHocBudget
  const overhead = day.overhead

  totalMeetingHours += meetingHours
  totalProjectHours += projectHours
  totalAdHocHours += adHocHours

  const totalUsed = meetingHours + projectHours + adHocHours + overhead
  if (totalUsed > defaults.workHours) {
    overcommitWarnings.push(
      `${day.date}: ${totalUsed.toFixed(1)}h allocated vs ${defaults.workHours}h available`
    )
  }

  return {
    date: day.date,
    meetingHours: Math.round(meetingHours * 100) / 100,
    projectHours: Math.round(projectHours * 100) / 100,
    adHocHours,
    overhead,
    availableHours: Math.max(
      0,
      Math.round((defaults.workHours - totalUsed) * 100) / 100
    ),
  }
})

const output = {
  weekStart,
  focusProjects: weekPlan.focusProjects,
  totalMeetingHours: Math.round(totalMeetingHours * 100) / 100,
  totalProjectHours: Math.round(totalProjectHours * 100) / 100,
  totalAdHocHours: Math.round(totalAdHocHours * 100) / 100,
  overcommitWarnings,
  dailyBreakdown,
}

process.stdout.write(JSON.stringify(output, null, 2) + '\n')
process.exit(0)
