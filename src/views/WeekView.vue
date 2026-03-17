<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/layout/AppHeader.vue'
import SidePanel from '../components/layout/SidePanel.vue'
import StackedAreaChart from '../components/charts/StackedAreaChart.vue'
import FocusSelector from '../components/projects/FocusSelector.vue'
import OvercommitWarning from '../components/alerts/OvercommitWarning.vue'
import SuggestionCard from '../components/alerts/SuggestionCard.vue'
import type { DayAllocation, DayDefaults, Project, WeekPlan, FocusProjectInfo, WeekStats } from '../types'
import { DEFAULT_DAY_DEFAULTS } from '../types'
import { useStorage } from '../composables/useStorage'
import { useAutoSuggest } from '../composables/useAutoSuggest'
import { useOvercommit } from '../composables/useOvercommit'
import { exportChartImage } from '../utils/imageExport'

const route = useRoute()
const router = useRouter()
const storage = useStorage()

const currentDate = computed(() => (route.params.date as string) ?? new Date().toISOString().split('T')[0])

// Load data from storage, re-read when week changes
const projects = ref<Project[]>(storage.get<Project[]>('projects') ?? [])
const weekPlan = ref<WeekPlan | null>(storage.get<WeekPlan>(`weekPlan:${currentDate.value}`) ?? null)
const dayDefaults = ref<DayDefaults>(storage.get<DayDefaults>('dayDefaults') ?? { ...DEFAULT_DAY_DEFAULTS })

function getPreviousWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

const today = ref(new Date().toISOString().split('T')[0])
const previousWeekPlan = ref<WeekPlan | null>(
  storage.get<WeekPlan>(`weekPlan:${getPreviousWeekDate(currentDate.value)}`) ?? null
)
const suggestionDismissed = ref(false)

watch(currentDate, (date) => {
  weekPlan.value = storage.get<WeekPlan>(`weekPlan:${date}`) ?? null
  projects.value = storage.get<Project[]>('projects') ?? []
  dayDefaults.value = storage.get<DayDefaults>('dayDefaults') ?? { ...DEFAULT_DAY_DEFAULTS }
  previousWeekPlan.value = storage.get<WeekPlan>(`weekPlan:${getPreviousWeekDate(date)}`) ?? null
  suggestionDismissed.value = false
  focusProjectIds.value = weekPlan.value?.focusProjects ?? []
  dayAssignments.value = restoreDayAssignments(weekPlan.value)
})

// Generate week data, always applying current dayDefaults for overhead/adHoc
const weekData = computed<DayAllocation[]>(() => {
  const defaults = dayDefaults.value
  if (weekPlan.value?.dailyAllocations?.length) {
    // Apply current dayDefaults to stored plan
    return weekPlan.value.dailyAllocations.map((day) => ({
      ...day,
      overhead: defaults.overhead,
      adHocBudget: defaults.adHocBudget,
    }))
  }
  // Generate default 5-day allocations
  const base = new Date(currentDate.value + 'T00:00:00')
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    return {
      date: d.toISOString().split('T')[0],
      meetings: [],
      overhead: defaults.overhead,
      adHocBudget: defaults.adHocBudget,
      projectAllocations: [],
    }
  })
})

const currentWeekPlan = computed<WeekPlan>(() => {
  if (weekPlan.value) return weekPlan.value
  return {
    weekStart: currentDate.value,
    focusProjects: [],
    dailyAllocations: weekData.value,
  }
})

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function restoreDayAssignments(plan: WeekPlan | null): Record<string, string[]> {
  if (!plan?.dailyAllocations) return {}
  const assignments: Record<string, string[]> = {}
  plan.dailyAllocations.forEach((day, i) => {
    const label = dayLabels[i]
    if (label && day.projectAllocations.length > 0) {
      assignments[label] = day.projectAllocations.map((a) => a.projectId)
    }
  })
  return assignments
}

const focusProjectIds = ref<string[]>(weekPlan.value?.focusProjects ?? [])
const dayAssignments = ref<Record<string, string[]>>(restoreDayAssignments(weekPlan.value))

const { suggestions } = useAutoSuggest(projects, currentWeekPlan, dayDefaults, today)
const { alerts: overcommitAlerts, status: overcommitStatus } = useOvercommit(
  focusProjectIds, projects, currentWeekPlan, previousWeekPlan, dayDefaults
)

function handleAutoSuggest() {
  const suggs = suggestions.value
  if (suggs.length === 0) return

  const newFocusIds = [...new Set(suggs.map((s) => s.projectId))]

  const newAssignments: Record<string, string[]> = {}
  for (const s of suggs) {
    const dayIndex = weekData.value.findIndex((d) => d.date === s.date)
    if (dayIndex >= 0 && dayIndex < dayLabels.length) {
      const label = dayLabels[dayIndex]
      if (!newAssignments[label]) newAssignments[label] = []
      newAssignments[label].push(s.projectId)
    }
  }

  focusProjectIds.value = newFocusIds
  dayAssignments.value = newAssignments
}

const focusProjectsList = computed<Project[]>(() =>
  projects.value.filter((p) => focusProjectIds.value.includes(p.id))
)

const focusProjectInfos = computed<FocusProjectInfo[]>(() =>
  focusProjectsList.value.map((p) => {
    const assignedDays: string[] = []
    for (const [day, ids] of Object.entries(dayAssignments.value)) {
      if (ids.includes(p.id)) assignedDays.push(day)
    }
    const totalHours = weekData.value.reduce(
      (sum, d) => sum + d.projectAllocations.filter((a) => a.projectId === p.id).reduce((s, a) => s + a.hours, 0),
      0
    )
    return { project: p, assignedDays, totalHours }
  })
)

const weekStats = computed<WeekStats>(() => {
  const data = weekData.value
  return {
    totalProjectTime: data.reduce(
      (sum, d) => sum + d.projectAllocations.reduce((s, a) => s + a.hours, 0),
      0
    ),
    meetingTime: data.reduce((sum, d) => {
      return sum + d.meetings.reduce((s, m) => {
        const start = new Date(m.start).getTime()
        const end = new Date(m.end).getTime()
        return s + (end - start) / (1000 * 60 * 60) + m.bufferBefore + m.bufferAfter
      }, 0)
    }, 0),
    overheadTime: data.reduce((sum, d) => sum + d.overhead, 0),
    adHocTime: data.reduce((sum, d) => sum + d.adHocBudget, 0),
  }
})

const overcommitLevel = computed<'healthy' | 'warning' | 'blocking'>(() => {
  if (overcommitStatus.value === 'blocking') return 'blocking'
  if (overcommitStatus.value === 'warning' || overcommitStatus.value === 'suggestion') return 'warning'
  return 'healthy'
})

function navigatePrev() {
  const d = new Date(currentDate.value + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  router.push({ name: 'week', params: { date: d.toISOString().split('T')[0] } })
}

function navigateNext() {
  const d = new Date(currentDate.value + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  router.push({ name: 'week', params: { date: d.toISOString().split('T')[0] } })
}

function navigateToday() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  router.push({ name: 'week', params: { date: monday.toISOString().split('T')[0] } })
}

function getMeetingHours(day: DayAllocation): number {
  return day.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60) + m.bufferBefore + m.bufferAfter
  }, 0)
}

function recalcProjectAllocations() {
  const base = weekData.value
  const updatedDays = base.map((day, i) => {
    const dayLabel = dayLabels[i]
    const assignedProjectIds = dayAssignments.value[dayLabel] ?? []
    if (assignedProjectIds.length === 0) {
      return { ...day, projectAllocations: [] }
    }
    const meetingH = getMeetingHours(day)
    const available = Math.max(0, dayDefaults.value.workHours - day.overhead - day.adHocBudget - meetingH)
    // Snap to 15min
    const perProject = Math.floor((available / assignedProjectIds.length) * 4) / 4
    const remainder = Math.round((available - perProject * assignedProjectIds.length) * 4) / 4
    const allocations = assignedProjectIds.map((projectId, j) => ({
      projectId,
      hours: j === 0 ? perProject + remainder : perProject,
    }))
    return { ...day, projectAllocations: allocations }
  })

  const plan: WeekPlan = {
    weekStart: currentDate.value,
    focusProjects: focusProjectIds.value,
    dailyAllocations: updatedDays,
  }
  weekPlan.value = plan
  storage.set(`weekPlan:${currentDate.value}`, plan)
}

watch([focusProjectIds, dayAssignments], recalcProjectAllocations, { deep: true })

function handleAllocationChange(dayIndex: number, field: 'overhead' | 'adHocBudget', value: number) {
  const data = [...weekData.value]
  if (data[dayIndex]) {
    data[dayIndex] = { ...data[dayIndex], [field]: value }
    const plan: WeekPlan = {
      weekStart: currentDate.value,
      focusProjects: focusProjectIds.value,
      dailyAllocations: data,
    }
    weekPlan.value = plan
    storage.set(`weekPlan:${currentDate.value}`, plan)
    // Recalculate project allocations since available time changed
    recalcProjectAllocations()
  }
}

function handleShare() {
  exportChartImage()
}
</script>

<template>
  <div class="week-view">
    <AppHeader
      :currentDate="currentDate"
      currentView="week"
      @update:currentView="(v) => v === 'day' && router.push({ name: 'day', params: { date: currentDate } })"
      @navigate-prev="navigatePrev"
      @navigate-next="navigateNext"
      @navigate-today="navigateToday"
      @share="handleShare"
    />

    <div class="week-content">
      <main class="week-main">
        <div data-export class="export-region">
          <section class="chart-section">
            <h2 class="section-heading">Weekly Allocation</h2>
            <StackedAreaChart
              :weekData="weekData"
              :focusProjects="focusProjectsList"
              :workHours="dayDefaults.workHours"
              @allocation-change="handleAllocationChange"
            />
          </section>

          <section class="focus-section">
            <FocusSelector
              :projects="projects"
              :selectedIds="focusProjectIds"
              :dayAssignments="dayAssignments"
              @update:selectedIds="focusProjectIds = $event"
              @update:dayAssignments="dayAssignments = $event"
              @auto-suggest="handleAutoSuggest"
            />
          </section>
        </div>

        <section v-if="overcommitAlerts.length > 0" class="warnings-section">
          <OvercommitWarning
            v-for="(alert, idx) in overcommitAlerts"
            :key="idx"
            :level="alert.level === 'suggestion' ? 'warning' : alert.level"
            :message="alert.message"
          />
        </section>

        <section v-if="weekStats.totalProjectTime === 0 && projects.length > 0 && !suggestionDismissed" class="suggestions-section">
          <SuggestionCard
            text="You have active projects but no time allocated yet. Select focus projects above to start planning your week."
            type="tip"
            @dismiss="suggestionDismissed = true"
            @see-breakdown="router.push({ name: 'day', params: { date: currentDate } })"
          />
        </section>
      </main>

      <SidePanel
        :focusProjects="focusProjectInfos"
        :weekStats="weekStats"
        :overcommitLevel="overcommitLevel"
      >
        <template #warnings>
          <OvercommitWarning
            v-for="(alert, idx) in overcommitAlerts"
            :key="idx"
            :level="alert.level === 'suggestion' ? 'warning' : alert.level"
            :message="alert.message"
          />
        </template>
      </SidePanel>
    </div>
  </div>
</template>

<style scoped>
.week-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
}

.week-content {
  display: flex;
  flex: 1;
}

.week-main {
  flex: 1;
  padding: var(--space-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
  overflow-y: auto;
}

.export-region {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
  background: var(--color-bg);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
}

.chart-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.section-heading {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.focus-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.warnings-section,
.suggestions-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
</style>
