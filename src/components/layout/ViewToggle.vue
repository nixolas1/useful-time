<script setup lang="ts">
defineProps<{
  modelValue: 'week' | 'day'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: 'week' | 'day']
}>()
</script>

<template>
  <div class="view-toggle">
    <button
      class="toggle-btn"
      :class="{ active: modelValue === 'week' }"
      @click="emit('update:modelValue', 'week')"
    >
      Week
    </button>
    <button
      class="toggle-btn"
      :class="{ active: modelValue === 'day' }"
      @click="emit('update:modelValue', 'day')"
    >
      Day
    </button>
  </div>
</template>

<style scoped>
.view-toggle {
  display: inline-flex;
  background: var(--color-border);
  border-radius: var(--radius-lg);
  padding: 2px;
  gap: 2px;
}

.toggle-btn {
  padding: 6px 16px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all 0.2s ease;
  line-height: 1.4;
}

.toggle-btn:hover {
  color: var(--color-text);
}

.toggle-btn.active {
  background: var(--color-bg-card);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
</style>
