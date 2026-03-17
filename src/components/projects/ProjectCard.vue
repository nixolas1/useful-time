<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '../../types'

const props = defineProps<{
  project: Project
}>()

const emit = defineEmits<{
  edit: [project: Project]
  delete: [projectId: string]
}>()

const completedTasks = computed(() =>
  props.project.tasks.filter((t) => t.status === 'done').length
)

const totalTasks = computed(() => props.project.tasks.length)

const progressPercent = computed(() =>
  totalTasks.value === 0 ? 0 : Math.round((completedTasks.value / totalTasks.value) * 100)
)

const statusLabel = computed(() => {
  const map = { active: 'Active', paused: 'Paused', completed: 'Completed' }
  return map[props.project.status]
})

function formatDateRange(start: string, end: string): string {
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return `${fmt(start)} - ${fmt(end)}`
}
</script>

<template>
  <div class="project-card">
    <div class="card-header">
      <span class="color-indicator" :style="{ background: project.color }"></span>
      <div class="card-title-area">
        <h3 class="card-title">{{ project.name }}</h3>
        <span class="date-range">{{ formatDateRange(project.startDate, project.endDate) }}</span>
      </div>
      <span class="status-badge" :class="project.status">{{ statusLabel }}</span>
    </div>

    <div v-if="totalTasks > 0" class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%', background: project.color }"></div>
      </div>
      <span class="progress-text">{{ completedTasks }}/{{ totalTasks }} tasks</span>
    </div>

    <ul v-if="project.tasks.length > 0" class="task-preview">
      <li v-for="task in project.tasks.slice(0, 3)" :key="task.id" class="task-preview-item">
        <span class="task-check" :class="{ done: task.status === 'done' }">
          <svg v-if="task.status === 'done'" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="task-name" :class="{ done: task.status === 'done' }">{{ task.name }}</span>
      </li>
      <li v-if="project.tasks.length > 3" class="task-preview-more">
        +{{ project.tasks.length - 3 }} more
      </li>
    </ul>

    <div class="card-actions">
      <button class="action-btn" @click="emit('edit', project)">Edit</button>
      <button class="action-btn danger" @click="emit('delete', project.id)">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.project-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  transition: box-shadow 0.15s ease;
}

.project-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 2px;
}

.card-title-area {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
}

.date-range {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.status-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.status-badge.active {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.paused {
  background: var(--color-warning-bg);
  color: #e65100;
}

.status-badge.completed {
  background: #e3f2fd;
  color: #1565c0;
}

.progress-section {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-bg);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.task-preview {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.task-check {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-bg-card);
}

.task-check.done {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.task-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.task-name.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.task-preview-more {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  padding-left: 22px;
}

.card-actions {
  display: flex;
  gap: var(--space-sm);
  padding-top: var(--space-xs);
  border-top: 1px solid var(--color-border);
}

.action-btn {
  font-size: var(--font-size-xs);
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.action-btn.danger:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: #fff5f5;
}
</style>
