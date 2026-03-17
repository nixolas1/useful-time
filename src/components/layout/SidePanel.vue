<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WeekStats, FocusProjectInfo } from '../../types'

const props = defineProps<{
  focusProjects: FocusProjectInfo[]
  weekStats: WeekStats
  overcommitLevel: 'healthy' | 'warning' | 'blocking'
}>()

const collapsed = ref(false)

const totalHours = computed(() =>
  props.weekStats.totalProjectTime + props.weekStats.meetingTime + props.weekStats.overheadTime + props.weekStats.adHocTime
)

function formatHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`
}

function formatPct(h: number): string {
  if (totalHours.value === 0) return '0%'
  return `${Math.round((h / totalHours.value) * 100)}%`
}
</script>

<template>
  <aside class="side-panel" :class="{ collapsed }">
    <button class="collapse-toggle" @click="collapsed = !collapsed" :title="collapsed ? 'Expand' : 'Collapse'">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          v-if="!collapsed"
          d="M9 3L5 7L9 11"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          v-else
          d="M5 3L9 7L5 11"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <div v-show="!collapsed" class="panel-content">
      <section class="panel-section">
        <h3 class="section-title">Focus Projects</h3>
        <div v-if="focusProjects.length === 0" class="empty-state">
          No focus projects selected
        </div>
        <div v-for="fp in focusProjects" :key="fp.project.id" class="focus-item">
          <div class="focus-header">
            <span class="color-dot" :style="{ background: fp.project.color }"></span>
            <span class="focus-name">{{ fp.project.name }}</span>
            <span class="focus-hours">{{ formatHours(fp.totalHours) }}</span>
          </div>
          <div class="focus-days">
            <span
              v-for="day in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']"
              :key="day"
              class="day-chip"
              :class="{ assigned: fp.assignedDays.includes(day) }"
            >
              {{ day }}
            </span>
          </div>
        </div>
      </section>

      <section class="panel-section">
        <h3 class="section-title">Week Summary</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-dot" style="background: var(--color-project)"></span>
            <span class="stat-label">Project Time</span>
            <span class="stat-pct">{{ formatPct(weekStats.totalProjectTime) }}</span>
            <span class="stat-value">{{ formatHours(weekStats.totalProjectTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background: var(--color-meetings)"></span>
            <span class="stat-label">Meetings</span>
            <span class="stat-pct">{{ formatPct(weekStats.meetingTime) }}</span>
            <span class="stat-value">{{ formatHours(weekStats.meetingTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background: var(--color-overhead)"></span>
            <span class="stat-label">Overhead</span>
            <span class="stat-pct">{{ formatPct(weekStats.overheadTime) }}</span>
            <span class="stat-value">{{ formatHours(weekStats.overheadTime) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-dot" style="background: var(--color-adhoc)"></span>
            <span class="stat-label">Ad-hoc</span>
            <span class="stat-pct">{{ formatPct(weekStats.adHocTime) }}</span>
            <span class="stat-value">{{ formatHours(weekStats.adHocTime) }}</span>
          </div>
        </div>
      </section>

      <section v-if="overcommitLevel !== 'healthy'" class="panel-section">
        <slot name="warnings"></slot>
      </section>
    </div>
  </aside>
</template>

<style scoped>
.side-panel {
  position: relative;
  width: 280px;
  min-width: 280px;
  background: var(--color-bg-card);
  border-left: 1px solid var(--color-border);
  padding: var(--space-xl);
  overflow-y: auto;
  transition: width 0.25s ease, min-width 0.25s ease, padding 0.25s ease;
}

.side-panel.collapsed {
  width: 40px;
  min-width: 40px;
  padding: var(--space-xl) var(--space-sm);
}

.collapse-toggle {
  position: absolute;
  top: var(--space-lg);
  right: var(--space-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  transition: all 0.15s ease;
  z-index: 1;
}

.collapsed .collapse-toggle {
  right: 50%;
  transform: translateX(50%);
}

.collapse-toggle:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  padding-top: var(--space-2xl);
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.empty-state {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  font-style: italic;
}

.focus-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
}

.focus-item + .focus-item {
  border-top: 1px solid var(--color-border);
}

.focus-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.focus-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-hours {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.focus-days {
  display: flex;
  gap: 3px;
  padding-left: 16px;
}

.day-chip {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--color-bg);
  color: var(--color-text-placeholder);
  font-weight: 500;
}

.day-chip.assigned {
  background: var(--color-project);
  color: var(--color-text);
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.stat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  flex: 1;
}

.stat-pct {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: right;
}

.stat-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}
</style>
