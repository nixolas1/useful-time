import { computed, type Ref } from 'vue'
import type { Project, WeekPlan, DayDefaults } from '../types'
import { calculateAvailableTime } from '../utils/timemath'

export interface DaySuggestion {
  projectId: string
  date: string
  availableHours: number
}

interface ScoredProject {
  projectId: string
  urgency: number
  remainingHours: number
  deadline: string
  daysOverdue: number
}

/**
 * Calculate urgency score for a project.
 * urgency = remainingHours / max(daysUntilDeadline, 1)
 * Past-deadline projects: urgency = Infinity, sorted by how overdue.
 */
function scoreProject(project: Project, today: string): ScoredProject | null {
  const remainingHours = project.tasks
    .filter((t) => t.status !== 'done')
    .reduce((sum, t) => sum + t.estimatedHours, 0)

  if (remainingHours <= 0) return null

  const todayDate = new Date(today + 'T12:00:00Z')
  const deadline = new Date(project.endDate + 'T12:00:00Z')
  const daysUntilDeadline = Math.round(
    (deadline.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (daysUntilDeadline <= 0) {
    return {
      projectId: project.id,
      urgency: Infinity,
      remainingHours,
      deadline: project.endDate,
      daysOverdue: Math.abs(daysUntilDeadline),
    }
  }

  return {
    projectId: project.id,
    urgency: remainingHours / Math.max(daysUntilDeadline, 1),
    remainingHours,
    deadline: project.endDate,
    daysOverdue: 0,
  }
}

/**
 * Sort scored projects: highest urgency first.
 * For Infinity urgencies, sort by most overdue first.
 * For ties, earlier deadline wins.
 */
function sortByPriority(a: ScoredProject, b: ScoredProject): number {
  // Both infinite: sort by most overdue
  if (a.urgency === Infinity && b.urgency === Infinity) {
    return b.daysOverdue - a.daysOverdue
  }
  // One infinite
  if (a.urgency === Infinity) return -1
  if (b.urgency === Infinity) return 1
  // Compare urgency
  if (Math.abs(a.urgency - b.urgency) > 0.001) {
    return b.urgency - a.urgency
  }
  // Tiebreak: earlier deadline
  return a.deadline.localeCompare(b.deadline)
}

/**
 * Auto-suggest day assignments using a greedy algorithm.
 *
 * Highest-priority project picks first from days with most available
 * project time, then next project. Each project gets at least 1 day.
 * Exception: if project has <1h remaining, gets 1 day only.
 */
export function useAutoSuggest(
  projects: Ref<Project[]>,
  currentWeek: Ref<WeekPlan>,
  defaults: Ref<DayDefaults>,
  today: Ref<string>,
) {
  const suggestions = computed<DaySuggestion[]>(() => {
    const focusIds = currentWeek.value.focusProjects
    if (focusIds.length === 0) return []

    // Score and sort focus projects
    const scored: ScoredProject[] = []
    for (const pid of focusIds) {
      const project = projects.value.find((p) => p.id === pid)
      if (!project) continue
      const score = scoreProject(project, today.value)
      if (score) scored.push(score)
    }

    if (scored.length === 0) return []

    scored.sort(sortByPriority)

    // Compute available time per day
    const dayAvailability = currentWeek.value.dailyAllocations.map((day) => {
      const dayDef: DayDefaults = {
        ...defaults.value,
        overhead: day.overhead,
        adHocBudget: day.adHocBudget,
      }
      return {
        date: day.date,
        available: calculateAvailableTime(day.meetings, dayDef),
        assigned: false,
      }
    })

    // Determine how many days each project gets
    const totalDays = dayAvailability.length
    const projectDayCounts: Map<string, number> = new Map()

    // Each project gets at least 1 day
    let remainingDays = totalDays

    // First pass: projects with <1h get exactly 1 day
    const smallProjects = scored.filter((s) => s.remainingHours < 1)
    const largeProjects = scored.filter((s) => s.remainingHours >= 1)

    for (const sp of smallProjects) {
      projectDayCounts.set(sp.projectId, 1)
      remainingDays--
    }

    // Distribute remaining days proportionally by urgency among large projects
    if (largeProjects.length > 0 && remainingDays > 0) {
      // Ensure each large project gets at least 1
      const minPerProject = Math.min(1, remainingDays)
      for (const lp of largeProjects) {
        projectDayCounts.set(lp.projectId, minPerProject)
      }
      let distributed = largeProjects.length * minPerProject
      let extraDays = remainingDays - distributed

      // Distribute extra days to highest priority
      for (let i = 0; i < largeProjects.length && extraDays > 0; i++) {
        const pid = largeProjects[i].projectId
        const current = projectDayCounts.get(pid) ?? 0
        const add = Math.min(extraDays, totalDays) // greedy: highest gets most
        projectDayCounts.set(pid, current + add)
        extraDays -= add
      }
    }

    // Greedy assignment: highest priority picks from best days first
    const result: DaySuggestion[] = []

    for (const project of scored) {
      const count = projectDayCounts.get(project.projectId) ?? 1

      // Sort available days by descending available time
      const availableDays = dayAvailability
        .filter((d) => !d.assigned)
        .sort((a, b) => b.available - a.available)

      const toAssign = Math.min(count, availableDays.length)

      for (let i = 0; i < toAssign; i++) {
        const day = availableDays[i]
        day.assigned = true
        result.push({
          projectId: project.projectId,
          date: day.date,
          availableHours: day.available,
        })
      }
    }

    return result
  })

  return { suggestions }
}
