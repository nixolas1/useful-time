<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import ViewToggle from "./ViewToggle.vue";

const props = defineProps<{
	currentDate: string;
	currentView: "week" | "day";
}>();

const emit = defineEmits<{
	"update:currentView": [value: "week" | "day"];
	share: [];
	"navigate-prev": [];
	"navigate-next": [];
	"navigate-today": [];
}>();

const router = useRouter();

const weekNumber = computed(() => {
	const date = new Date(props.currentDate + "T00:00:00");
	const startOfYear = new Date(date.getFullYear(), 0, 1);
	const diff = date.getTime() - startOfYear.getTime();
	const oneWeek = 7 * 24 * 60 * 60 * 1000;
	return Math.ceil(diff / oneWeek + 1);
});

const displayLabel = computed(() => {
	const date = new Date(props.currentDate + "T00:00:00");
	if (props.currentView === "week") {
		return `Week ${weekNumber.value}`;
	}
	return date.toLocaleDateString("en-US", {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
});

function onViewChange(view: "week" | "day") {
	emit("update:currentView", view);
	if (view === "week") {
		router.push({ name: "week", params: { date: props.currentDate } });
	} else {
		router.push({ name: "day", params: { date: props.currentDate } });
	}
}

function goToSettings() {
	router.push({ name: "settings" });
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="app-name">useful time</h1>
      <ViewToggle :modelValue="currentView" @update:modelValue="onViewChange" />
    </div>

    <div class="header-center">
      <button class="nav-btn" @click="emit('navigate-prev')" aria-label="Previous">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span class="date-label">{{ displayLabel }}</span>
      <button class="nav-btn" @click="emit('navigate-next')" aria-label="Next">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="today-btn" @click="emit('navigate-today')">Today</button>
    </div>

    <div class="header-right">
      <button class="icon-btn" @click="emit('share')" title="Share / Export image">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 8V12C4 12.5523 4.44772 13 5 13H11C11.5523 13 12 12.5523 12 12V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 2V9M8 2L5.5 4.5M8 2L10.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="icon-btn" @click="goToSettings" title="Settings">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 1.5V3M8 13V14.5M1.5 8H3M13 8H14.5M3.05 3.05L4.1 4.1M11.9 11.9L12.95 12.95M12.95 3.05L11.9 4.1M4.1 11.9L3.05 12.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg) var(--space-2xl);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  min-height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-xl);
}

.app-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.header-center {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.date-label {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: var(--color-text);
  min-width: 140px;
  text-align: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.nav-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.today-btn {
  padding: 2px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.today-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  transition: all 0.15s ease;
}

.icon-btn:hover {
  background: var(--color-bg);
  color: var(--color-text);
}
</style>
