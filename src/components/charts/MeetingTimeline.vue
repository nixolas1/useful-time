<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Meeting } from '../../types'

const props = defineProps<{
  meetings: Meeting[]
  workdayStart?: string
  workHours?: number
}>()

const startHour = computed(() => {
  const [h] = (props.workdayStart ?? '09:00').split(':').map(Number)
  return h
})

const totalHours = computed(() => props.workHours ?? 8)
const endHour = computed(() => startHour.value + totalHours.value)

const hourMarkers = computed(() => {
  const markers: number[] = []
  for (let h = startHour.value; h <= endHour.value; h++) {
    markers.push(h)
  }
  return markers
})

function toPercent(timeStr: string): number {
  const d = new Date(timeStr)
  const h = d.getHours() + d.getMinutes() / 60
  return ((h - startHour.value) / totalHours.value) * 100
}

function formatTime(timeStr: string): string {
  const d = new Date(timeStr)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, val))
}

const hoveredMeeting = ref<string | null>(null)
const tooltipStyle = ref({ left: '0px', top: '0px' })

function onMeetingHover(meeting: Meeting, event: MouseEvent) {
  hoveredMeeting.value = meeting.id
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const parentRect = (event.currentTarget as HTMLElement).closest('.meeting-timeline')?.getBoundingClientRect()
  if (parentRect) {
    tooltipStyle.value = {
      left: `${rect.left - parentRect.left + rect.width / 2}px`,
      top: `${rect.top - parentRect.top - 8}px`,
    }
  }
}
</script>

<template>
  <div class="meeting-timeline">
    <div class="timeline-track">
      <!-- Hour markers -->
      <div
        v-for="hour in hourMarkers"
        :key="hour"
        class="hour-marker"
        :style="{ left: ((hour - startHour) / totalHours) * 100 + '%' }"
      >
        <span class="hour-label">{{ hour > 12 ? hour - 12 : hour }}{{ hour >= 12 ? 'p' : 'a' }}</span>
        <span class="hour-tick"></span>
      </div>

      <!-- Meeting blocks -->
      <div
        v-for="meeting in meetings"
        :key="meeting.id"
        class="meeting-block-wrapper"
        :style="{
          left: clamp(toPercent(meeting.start) - (meeting.bufferBefore / totalHours) * 100) + '%',
          width: clamp(
            toPercent(meeting.end) + (meeting.bufferAfter / totalHours) * 100 -
            toPercent(meeting.start) + (meeting.bufferBefore / totalHours) * 100
          ) + '%',
        }"
      >
        <!-- Buffer before -->
        <div
          v-if="meeting.bufferBefore > 0"
          class="buffer buffer-before"
          :style="{ width: (meeting.bufferBefore / totalHours) * 100 / (
            (toPercent(meeting.end) + (meeting.bufferAfter / totalHours) * 100 -
            toPercent(meeting.start) + (meeting.bufferBefore / totalHours) * 100) / 100
          ) + '%' }"
        ></div>

        <!-- Meeting block -->
        <div
          class="meeting-block"
          @mouseenter="onMeetingHover(meeting, $event)"
          @mouseleave="hoveredMeeting = null"
        >
          <span class="meeting-title">{{ meeting.title }}</span>
        </div>

        <!-- Buffer after -->
        <div
          v-if="meeting.bufferAfter > 0"
          class="buffer buffer-after"
          :style="{ width: (meeting.bufferAfter / totalHours) * 100 / (
            (toPercent(meeting.end) + (meeting.bufferAfter / totalHours) * 100 -
            toPercent(meeting.start) + (meeting.bufferBefore / totalHours) * 100) / 100
          ) + '%' }"
        ></div>
      </div>
    </div>

    <!-- Tooltip -->
    <div
      v-if="hoveredMeeting"
      class="timeline-tooltip"
      :style="tooltipStyle"
    >
      <template v-for="m in meetings" :key="m.id">
        <div v-if="m.id === hoveredMeeting">
          <div class="tooltip-title">{{ m.title }}</div>
          <div class="tooltip-time">{{ formatTime(m.start) }} - {{ formatTime(m.end) }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.meeting-timeline {
  position: relative;
  padding: var(--space-2xl) 0 var(--space-lg);
}

.timeline-track {
  position: relative;
  height: 36px;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow: visible;
}

.hour-marker {
  position: absolute;
  top: -18px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hour-label {
  font-size: 10px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.hour-tick {
  width: 1px;
  height: 8px;
  background: var(--color-border);
}

.meeting-block-wrapper {
  position: absolute;
  top: 4px;
  height: 28px;
  display: flex;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.buffer {
  background: var(--color-meetings);
  opacity: 0.25;
}

.meeting-block {
  flex: 1;
  background: var(--color-meetings);
  opacity: 0.7;
  display: flex;
  align-items: center;
  padding: 0 var(--space-sm);
  overflow: hidden;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.meeting-block:hover {
  opacity: 1;
}

.meeting-title {
  font-size: 10px;
  font-weight: 500;
  color: #5a2020;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-tooltip {
  position: absolute;
  transform: translateX(-50%) translateY(-100%);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 10;
  white-space: nowrap;
  pointer-events: none;
}

.tooltip-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.tooltip-time {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>
