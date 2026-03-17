<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Project, Task } from '../../types'
import { PROJECT_PALETTE } from '../../types'
import TaskList from './TaskList.vue'

const props = defineProps<{
  project?: Project | null
}>()

const emit = defineEmits<{
  save: [project: Omit<Project, 'id'> & { id?: string }]
  cancel: []
}>()

const name = ref('')
const color = ref(PROJECT_PALETTE[0])
const startDate = ref('')
const endDate = ref('')
const status = ref<Project['status']>('active')
const tasks = ref<Task[]>([])

const isEditing = computed(() => !!props.project)

watch(
  () => props.project,
  (p) => {
    if (p) {
      name.value = p.name
      color.value = p.color
      startDate.value = p.startDate
      endDate.value = p.endDate
      status.value = p.status
      tasks.value = [...p.tasks.map((t) => ({ ...t }))]
    } else {
      resetForm()
    }
  },
  { immediate: true }
)

function resetForm() {
  name.value = ''
  color.value = PROJECT_PALETTE[0]
  const today = new Date()
  startDate.value = today.toISOString().split('T')[0]
  const twoWeeks = new Date(today)
  twoWeeks.setDate(twoWeeks.getDate() + 14)
  endDate.value = twoWeeks.toISOString().split('T')[0]
  status.value = 'active'
  tasks.value = []
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function handleAddTask(taskData: { name: string; estimatedHours: number }) {
  tasks.value.push({
    id: generateId(),
    name: taskData.name,
    estimatedHours: taskData.estimatedHours,
    status: 'todo',
  })
}

function handleUpdateTask(updated: Task) {
  const idx = tasks.value.findIndex((t) => t.id === updated.id)
  if (idx !== -1) {
    tasks.value[idx] = updated
  }
}

function handleRemoveTask(taskId: string) {
  tasks.value = tasks.value.filter((t) => t.id !== taskId)
}

function handleSave() {
  if (!name.value.trim()) return
  emit('save', {
    ...(props.project ? { id: props.project.id } : {}),
    name: name.value.trim(),
    color: color.value,
    startDate: startDate.value,
    endDate: endDate.value,
    status: status.value,
    tasks: tasks.value,
  })
}

const isValid = computed(() => name.value.trim().length > 0 && startDate.value && endDate.value)
</script>

<template>
  <div class="project-form">
    <h2 class="form-title">{{ isEditing ? 'Edit Project' : 'New Project' }}</h2>

    <div class="form-field">
      <label class="field-label">Name</label>
      <input v-model="name" type="text" class="field-input" placeholder="Project name" />
    </div>

    <div class="form-field">
      <label class="field-label">Color</label>
      <div class="color-grid">
        <button
          v-for="c in PROJECT_PALETTE"
          :key="c"
          class="color-swatch"
          :class="{ selected: color === c }"
          :style="{ background: c }"
          @click="color = c"
          :title="c"
        ></button>
      </div>
    </div>

    <div class="form-row">
      <div class="form-field">
        <label class="field-label">Start Date</label>
        <input v-model="startDate" type="date" class="field-input" />
      </div>
      <div class="form-field">
        <label class="field-label">End Date</label>
        <input v-model="endDate" type="date" class="field-input" />
      </div>
    </div>

    <div v-if="isEditing" class="form-field">
      <label class="field-label">Status</label>
      <select v-model="status" class="field-input">
        <option value="active">Active</option>
        <option value="paused">Paused</option>
        <option value="completed">Completed</option>
      </select>
    </div>

    <div class="form-field">
      <label class="field-label">Tasks</label>
      <div class="tasks-container">
        <TaskList
          :tasks="tasks"
          @add-task="handleAddTask"
          @update-task="handleUpdateTask"
          @remove-task="handleRemoveTask"
        />
      </div>
    </div>

    <div class="form-actions">
      <button class="btn btn-secondary" @click="emit('cancel')">Cancel</button>
      <button class="btn btn-primary" @click="handleSave" :disabled="!isValid">
        {{ isEditing ? 'Save Changes' : 'Create Project' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.project-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  max-width: 480px;
}

.form-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
}

.form-row {
  display: flex;
  gap: var(--space-lg);
}

.field-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.field-input {
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: border-color 0.15s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-text-muted);
}

.color-grid {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-swatch:hover {
  transform: scale(1.1);
}

.color-swatch.selected {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-bg-card), 0 0 0 4px var(--color-text);
}

.tasks-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.btn {
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.btn-secondary:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.btn-primary {
  background: var(--color-text);
  color: var(--color-bg-card);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
