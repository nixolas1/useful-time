<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Project } from '../../types'

const props = defineProps<{
  projects: Project[]
  selectedIds: string[]
  dayAssignments: Record<string, string[]>
}>()

const emit = defineEmits<{
  'update:selectedIds': [ids: string[]]
  'update:dayAssignments': [assignments: Record<string, string[]>]
  'auto-suggest': []
}>()

const showBlockDialog = ref(false)
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

const activeProjects = computed(() =>
  props.projects
    .filter((p) => p.status === 'active')
    .sort((a, b) => {
      const aEnd = new Date(a.endDate).getTime()
      const bEnd = new Date(b.endDate).getTime()
      return aEnd - bEnd
    })
)

function toggleProject(projectId: string) {
  const current = [...props.selectedIds]
  const idx = current.indexOf(projectId)
  if (idx !== -1) {
    current.splice(idx, 1)
    emit('update:selectedIds', current)
  } else {
    if (current.length >= 3) {
      showBlockDialog.value = true
      return
    }
    current.push(projectId)
    emit('update:selectedIds', current)
  }
}

function toggleDayAssignment(day: string, projectId: string) {
  const assignments = { ...props.dayAssignments }
  if (!assignments[day]) {
    assignments[day] = []
  }
  const dayList = [...assignments[day]]
  const idx = dayList.indexOf(projectId)
  if (idx !== -1) {
    dayList.splice(idx, 1)
  } else {
    dayList.push(projectId)
  }
  assignments[day] = dayList
  emit('update:dayAssignments', assignments)
}

function isDayAssigned(day: string, projectId: string): boolean {
  return props.dayAssignments[day]?.includes(projectId) ?? false
}

function getProjectColor(projectId: string): string {
  return props.projects.find((p) => p.id === projectId)?.color ?? '#ccc'
}

function daysUntilDeadline(endDate: string): number {
  const now = new Date()
  const end = new Date(endDate + 'T00:00:00')
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
</script>

<template>
  <div class="focus-selector">
    <div class="selector-header">
      <h3 class="selector-title">Focus Projects</h3>
      <button class="auto-btn" @click="emit('auto-suggest')">Auto-suggest</button>
    </div>

    <p class="selector-hint">Select up to 3 projects to focus on this week</p>

    <div class="project-list">
      <label
        v-for="project in activeProjects"
        :key="project.id"
        class="project-option"
        :class="{ selected: selectedIds.includes(project.id) }"
      >
        <input
          type="checkbox"
          :checked="selectedIds.includes(project.id)"
          @change="toggleProject(project.id)"
          class="sr-only"
        />
        <span class="option-check" :style="selectedIds.includes(project.id) ? { background: project.color, borderColor: project.color } : {}">
          <svg v-if="selectedIds.includes(project.id)" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="option-color" :style="{ background: project.color }"></span>
        <span class="option-name">{{ project.name }}</span>
        <span class="option-urgency" :class="{ urgent: daysUntilDeadline(project.endDate) <= 7 }">
          {{ daysUntilDeadline(project.endDate) }}d left
        </span>
      </label>
    </div>

    <div v-if="selectedIds.length > 0" class="day-grid">
      <div class="grid-header">
        <div class="grid-label"></div>
        <div v-for="day in days" :key="day" class="grid-day-label">{{ day }}</div>
      </div>
      <div v-for="pId in selectedIds" :key="pId" class="grid-row">
        <div class="grid-project-label">
          <span class="grid-dot" :style="{ background: getProjectColor(pId) }"></span>
          <span class="grid-project-name">{{ projects.find((p) => p.id === pId)?.name }}</span>
        </div>
        <button
          v-for="day in days"
          :key="day"
          class="grid-cell"
          :class="{ active: isDayAssigned(day, pId) }"
          :style="isDayAssigned(day, pId) ? { background: getProjectColor(pId) + '40' } : {}"
          @click="toggleDayAssignment(day, pId)"
        >
          <span v-if="isDayAssigned(day, pId)" class="cell-check">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>
      </div>
    </div>

    <!-- Blocking dialog when trying to add 4th project -->
    <Teleport to="body">
      <div v-if="showBlockDialog" class="dialog-overlay" @click.self="showBlockDialog = false">
        <div class="dialog">
          <h3 class="dialog-title">Maximum Focus Projects</h3>
          <p class="dialog-text">
            You can focus on at most 3 projects per week. Deselect an existing project first to add a new one.
          </p>
          <button class="dialog-btn" @click="showBlockDialog = false">Got it</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.focus-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.selector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selector-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.auto-btn {
  font-size: var(--font-size-xs);
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.auto-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.selector-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.project-option {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.1s ease;
}

.project-option:hover {
  background: var(--color-bg);
}

.project-option.selected {
  background: var(--color-bg);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.option-check {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.option-color {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.option-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.option-urgency {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.option-urgency.urgent {
  color: var(--color-danger);
  font-weight: 600;
}

.day-grid {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin-top: var(--space-sm);
}

.grid-header {
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.grid-label {
  padding: var(--space-xs) var(--space-sm);
}

.grid-day-label {
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-align: center;
  color: var(--color-text-muted);
}

.grid-row {
  display: grid;
  grid-template-columns: 120px repeat(5, 1fr);
  border-bottom: 1px solid var(--color-border);
}

.grid-row:last-child {
  border-bottom: none;
}

.grid-project-label {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm);
  overflow: hidden;
}

.grid-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.grid-project-name {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-left: 1px solid var(--color-border);
  background: transparent;
  padding: var(--space-sm);
  transition: background 0.1s ease;
  min-height: 36px;
}

.grid-cell:hover {
  background: var(--color-bg);
}

.grid-cell.active {
  background: var(--color-project);
}

.cell-check {
  color: var(--color-success);
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  max-width: 360px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.dialog-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-sm);
}

.dialog-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-lg);
}

.dialog-btn {
  padding: var(--space-sm) var(--space-xl);
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-text);
  color: var(--color-bg-card);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.dialog-btn:hover {
  opacity: 0.9;
}
</style>
