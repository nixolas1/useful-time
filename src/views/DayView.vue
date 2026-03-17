<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/layout/AppHeader.vue'
import DonutChart from '../components/charts/DonutChart.vue'
import MeetingTimeline from '../components/charts/MeetingTimeline.vue'
import type { DayAllocation, DayDefaults, Project, WeekPlan } from '../types'
import { DEFAULT_DAY_DEFAULTS, CATEGORY_COLORS } from '../types'
import { useStorage } from '../composables/useStorage'
import { exportChartImage } from '../utils/imageExport'

const route = useRoute()
const router = useRouter()
const storage = useStorage()

const currentDate = computed(() => (route.params.date as string) ?? new Date().toISOString().split('T')[0])

const projects = ref<Project[]>(storage.get<Project[]>('projects') ?? [])
const dayDefaults = ref<DayDefaults>(storage.get<DayDefaults>('dayDefaults') ?? { ...DEFAULT_DAY_DEFAULTS })

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const dayOfWeek = d.getDay()
  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  const y = monday.getFullYear()
  const m = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Try to load day allocation from week plan, always applying current defaults
const dayData = computed<DayAllocation>(() => {
  const defaults = dayDefaults.value
  const weekKey = getWeekKey(currentDate.value)

  const weekPlan = storage.get<WeekPlan>(`weekPlan:${weekKey}`)
  if (weekPlan?.dailyAllocations) {
    const found = weekPlan.dailyAllocations.find((a) => a.date === currentDate.value)
    if (found) {
      return {
        ...found,
        overhead: defaults.overhead,
        adHocBudget: defaults.adHocBudget,
      }
    }
  }

  // Default day
  return {
    date: currentDate.value,
    meetings: [],
    overhead: defaults.overhead,
    adHocBudget: defaults.adHocBudget,
    projectAllocations: [],
  }
})

const focusProjects = computed<Project[]>(() => {
  const ids = dayData.value.projectAllocations.map((a) => a.projectId)
  return projects.value.filter((p) => ids.includes(p.id))
})

function getMeetingHours(): number {
  return dayData.value.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60) + m.bufferBefore + m.bufferAfter
  }, 0)
}

const breakdownItems = computed(() => {
  const meetingH = getMeetingHours()
  const projectH = dayData.value.projectAllocations.reduce((s, a) => s + a.hours, 0)
  const available = Math.max(0, dayDefaults.value.workHours - meetingH - dayData.value.overhead - dayData.value.adHocBudget)
  return [
    { label: 'Meetings', hours: meetingH, color: CATEGORY_COLORS.meetings },
    { label: 'Overhead', hours: dayData.value.overhead, color: CATEGORY_COLORS.overhead },
    { label: 'Ad-hoc budget', hours: dayData.value.adHocBudget, color: CATEGORY_COLORS.adHoc },
    { label: 'Project time', hours: projectH || available, color: CATEGORY_COLORS.project },
  ]
})

const dayName = computed(() => {
  const d = new Date(currentDate.value + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
})

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function navigatePrev() {
  const d = new Date(currentDate.value + 'T12:00:00')
  d.setDate(d.getDate() - 1)
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1)
  }
  router.push({ name: 'day', params: { date: formatDate(d) } })
}

function navigateNext() {
  const d = new Date(currentDate.value + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1)
  }
  router.push({ name: 'day', params: { date: formatDate(d) } })
}

function navigateToday() {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1)
  else if (d.getDay() === 6) d.setDate(d.getDate() + 2)
  router.push({ name: 'day', params: { date: formatDate(d) } })
}

function handleAllocationChange(field: 'overhead' | 'adHocBudget', value: number) {
  // Update the dayDefaults in storage
  dayDefaults.value = { ...dayDefaults.value, [field]: value }
  storage.set('dayDefaults', dayDefaults.value)
}

function handleShare() {
  exportChartImage()
}

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}
</script>

<template>
  <div class="day-view">
    <AppHeader
      :currentDate="currentDate"
      currentView="day"
      @update:currentView="(v) => v === 'week' && router.push({ name: 'week', params: { date: currentDate } })"
      @navigate-prev="navigatePrev"
      @navigate-next="navigateNext"
      @navigate-today="navigateToday"
      @share="handleShare"
    />

    <main class="day-content">
      <div data-export class="export-region">
        <div class="day-layout">
          <div class="chart-and-breakdown">
            <div class="donut-wrapper">
              <DonutChart
                :dayData="dayData"
                :focusProjects="focusProjects"
                :workHours="dayDefaults.workHours"
                @allocation-change="handleAllocationChange"
              />
            </div>

            <div class="breakdown-list">
              <h2 class="day-title">{{ dayName }}</h2>
              <div class="breakdown-items">
                <div v-for="item in breakdownItems" :key="item.label" class="breakdown-item">
                  <span class="breakdown-dot" :style="{ background: item.color }"></span>
                  <span class="breakdown-label">{{ item.label }}</span>
                  <span class="breakdown-value">{{ formatHours(item.hours) }}</span>
                  <span class="breakdown-bar-wrapper">
                    <span
                      class="breakdown-bar"
                      :style="{
                        width: (item.hours / dayDefaults.workHours) * 100 + '%',
                        background: item.color,
                      }"
                    ></span>
                  </span>
                </div>
              </div>

              <!-- Project allocations detail -->
              <div v-if="dayData.projectAllocations.length > 0" class="project-detail">
                <h3 class="detail-heading">Project Breakdown</h3>
                <div v-for="alloc in dayData.projectAllocations" :key="alloc.projectId" class="detail-item">
                  <span
                    class="detail-dot"
                    :style="{ background: projects.find((p) => p.id === alloc.projectId)?.color ?? CATEGORY_COLORS.project }"
                  ></span>
                  <span class="detail-name">
                    {{ projects.find((p) => p.id === alloc.projectId)?.name ?? 'Unknown' }}
                  </span>
                  <span class="detail-hours">{{ formatHours(alloc.hours) }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="timeline-section">
            <h3 class="timeline-heading">Meetings</h3>
            <MeetingTimeline
              v-if="dayData.meetings.length > 0"
              :meetings="dayData.meetings"
              :workdayStart="dayDefaults.workdayStart"
              :workHours="dayDefaults.workHours"
            />
            <p v-else class="no-meetings">No meetings scheduled</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.day-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
}

.day-content {
  flex: 1;
  padding: var(--space-2xl);
  overflow-y: auto;
}

.export-region {
  max-width: 860px;
  margin: 0 auto;
}

.day-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.chart-and-breakdown {
  display: flex;
  gap: var(--space-2xl);
  align-items: flex-start;
}

.donut-wrapper {
  flex-shrink: 0;
}

.breakdown-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-width: 0;
}

.day-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
}

.breakdown-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.breakdown-item {
  display: grid;
  grid-template-columns: 10px 120px 40px 1fr;
  align-items: center;
  gap: var(--space-sm);
}

.breakdown-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.breakdown-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.breakdown-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.breakdown-bar-wrapper {
  height: 6px;
  background: var(--color-bg);
  border-radius: 3px;
  overflow: hidden;
}

.breakdown-bar {
  display: block;
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.project-detail {
  margin-top: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-heading {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.detail-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.detail-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.detail-hours {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

.timeline-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg) var(--space-xl);
}

.timeline-heading {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.no-meetings {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  font-style: italic;
  padding: var(--space-md) 0;
}
</style>
