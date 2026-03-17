<script setup lang="ts">
defineProps<{
  text: string
  type?: 'info' | 'tip' | 'action'
}>()

const emit = defineEmits<{
  dismiss: []
  'see-breakdown': []
}>()
</script>

<template>
  <div class="suggestion-card" :class="type ?? 'info'">
    <div class="suggestion-content">
      <svg class="suggestion-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/>
        <path d="M7 4V7.5M7 9V9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <p class="suggestion-text">{{ text }}</p>
    </div>
    <div class="suggestion-actions">
      <button class="suggestion-btn" @click="emit('see-breakdown')">See breakdown</button>
      <button class="suggestion-btn dismiss" @click="emit('dismiss')">Dismiss</button>
    </div>
  </div>
</template>

<style scoped>
.suggestion-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.suggestion-card.info {
  border-left: 3px solid var(--color-adhoc);
}

.suggestion-card.tip {
  border-left: 3px solid var(--color-project);
}

.suggestion-card.action {
  border-left: 3px solid var(--color-overhead);
}

.suggestion-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.suggestion-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 1px;
}

.suggestion-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.suggestion-actions {
  display: flex;
  gap: var(--space-sm);
  padding-left: 22px;
}

.suggestion-btn {
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  transition: all 0.15s ease;
}

.suggestion-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.suggestion-btn.dismiss {
  color: var(--color-text-placeholder);
}
</style>
