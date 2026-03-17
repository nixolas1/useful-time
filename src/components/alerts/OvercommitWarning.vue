<script setup lang="ts">
defineProps<{
  level: 'healthy' | 'warning' | 'blocking'
  message: string
  details?: string
}>()
</script>

<template>
  <div class="overcommit-warning" :class="level">
    <div class="warning-icon">
      <svg v-if="level === 'blocking'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 4.5V8.5M8 10.5V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="level === 'warning'" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5L14.5 13H1.5L8 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M8 6V9M8 10.5V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="warning-content">
      <p class="warning-message">{{ message }}</p>
      <p v-if="details" class="warning-details">{{ details }}</p>
    </div>
  </div>
</template>

<style scoped>
.overcommit-warning {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border-left: 3px solid;
}

.overcommit-warning.blocking {
  background: #fff5f5;
  border-left-color: var(--color-danger);
  color: var(--color-danger);
}

.overcommit-warning.warning {
  background: var(--color-warning-bg);
  border-left-color: #e67700;
  color: #e67700;
}

.overcommit-warning.healthy {
  background: #f0faf3;
  border-left-color: var(--color-success);
  color: var(--color-success);
}

.warning-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.warning-content {
  flex: 1;
  min-width: 0;
}

.warning-message {
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: 1.4;
}

.warning-details {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  margin-top: 2px;
  line-height: 1.4;
}
</style>
