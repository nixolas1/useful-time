<script setup lang="ts">
import { ref } from 'vue'
import type { Task } from '../../types'

defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  'update-task': [task: Task]
  'remove-task': [taskId: string]
  'add-task': [task: { name: string; estimatedHours: number }]
}>()

const newTaskName = ref('')
const newTaskHours = ref(1)

function addTask() {
  const name = newTaskName.value.trim()
  if (!name) return
  emit('add-task', { name, estimatedHours: newTaskHours.value })
  newTaskName.value = ''
  newTaskHours.value = 1
}

function toggleTask(task: Task) {
  const nextStatus = task.status === 'done' ? 'todo' : 'done'
  emit('update-task', { ...task, status: nextStatus })
}
</script>

<template>
  <div class="task-list">
    <div v-for="task in tasks" :key="task.id" class="task-row">
      <button class="task-checkbox" :class="{ done: task.status === 'done' }" @click="toggleTask(task)">
        <svg v-if="task.status === 'done'" width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="task-name" :class="{ done: task.status === 'done' }">{{ task.name }}</span>
      <span class="task-hours">{{ task.estimatedHours }}h</span>
      <button class="remove-btn" @click="emit('remove-task', task.id)" title="Remove task">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="add-task-row">
      <input
        v-model="newTaskName"
        class="add-task-input"
        type="text"
        placeholder="Add a task..."
        @keydown.enter="addTask"
      />
      <input
        v-model.number="newTaskHours"
        class="add-task-hours"
        type="number"
        min="0.25"
        step="0.25"
        title="Estimated hours"
      />
      <button class="add-task-btn" @click="addTask" :disabled="!newTaskName.trim()">Add</button>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background 0.1s ease;
}

.task-row:hover {
  background: var(--color-bg);
}

.task-row:hover .remove-btn {
  opacity: 1;
}

.task-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1.5px solid var(--color-border);
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: white;
  padding: 0;
  transition: all 0.15s ease;
}

.task-checkbox.done {
  background: var(--color-success);
  border-color: var(--color-success);
}

.task-name {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.task-name.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.task-hours {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 24px;
  text-align: right;
}

.remove-btn {
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  padding: 0;
  transition: all 0.15s ease;
}

.remove-btn:hover {
  color: var(--color-danger);
  background: #fff5f5;
}

.add-task-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-top: var(--space-xs);
  border-top: 1px solid var(--color-border);
}

.add-task-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  outline: none;
}

.add-task-input::placeholder {
  color: var(--color-text-placeholder);
}

.add-task-hours {
  width: 48px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  font-size: var(--font-size-xs);
  text-align: center;
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.add-task-hours:focus {
  outline: none;
  border-color: var(--color-text-muted);
}

.add-task-btn {
  font-size: var(--font-size-xs);
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.add-task-btn:hover:not(:disabled) {
  background: var(--color-bg);
  color: var(--color-text);
}

.add-task-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
