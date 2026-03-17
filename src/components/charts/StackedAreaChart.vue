<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import type { DayAllocation, Project } from '../../types'
import { CATEGORY_COLORS } from '../../types'

const props = defineProps<{
  weekData: DayAllocation[]
  focusProjects: Project[]
  workHours?: number
}>()

const emit = defineEmits<{
  'allocation-change': [dayIndex: number, field: 'overhead' | 'adHocBudget', value: number]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const tooltipRef = ref<HTMLDivElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const margin = { top: 20, right: 30, bottom: 40, left: 50 }
const width = 700
const height = 360
const innerWidth = width - margin.left - margin.right
const innerHeight = height - margin.top - margin.bottom
const maxHours = computed(() => props.workHours ?? 8)

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function getMeetingHours(day: DayAllocation): number {
  return day.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60) + m.bufferBefore + m.bufferAfter
  }, 0)
}

function getProjectHours(day: DayAllocation): number {
  return day.projectAllocations.reduce((sum, a) => sum + a.hours, 0)
}

type DragState = {
  dayIndex: number
  field: 'adHocBoundary'
  startY: number
  startValue: number
} | null

const dragState = ref<DragState>(null)
const hoverDayIndex = ref<number | null>(null)

function drawChart() {
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  if (!props.weekData || props.weekData.length === 0) return

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`)

  // Scales
  const x = d3.scalePoint<string>()
    .domain(dayLabels)
    .range([0, innerWidth])
    .padding(0.1)

  const y = d3.scaleLinear()
    .domain([0, maxHours.value])
    .range([innerHeight, 0])

  // Axes
  g.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(x))
    .call((g) => g.select('.domain').remove())
    .call((g) => g.selectAll('.tick line').remove())
    .call((g) =>
      g.selectAll('.tick text')
        .attr('fill', '#8a8078')
        .attr('font-size', '12px')
        .attr('font-weight', '500')
    )

  g.append('g')
    .attr('class', 'y-axis')
    .call(
      d3.axisLeft(y)
        .ticks(maxHours.value)
        .tickFormat((d) => `${+d}h`)
    )
    .call((g) => g.select('.domain').remove())
    .call((g) =>
      g.selectAll('.tick line')
        .attr('x2', innerWidth)
        .attr('stroke', '#e8e0d4')
        .attr('stroke-dasharray', '2,4')
    )
    .call((g) =>
      g.selectAll('.tick text')
        .attr('fill', '#8a8078')
        .attr('font-size', '11px')
    )

  // Prepare stacked data for each day
  const data = props.weekData.map((day, i) => {
    const meetingH = getMeetingHours(day)
    const overheadH = day.overhead
    const adHocH = day.adHocBudget
    const projectH = getProjectHours(day)
    return {
      label: dayLabels[i] ?? `Day ${i + 1}`,
      meetings: meetingH,
      overhead: overheadH,
      adHoc: adHocH,
      project: projectH,
      y0_meetings: 0,
      y1_meetings: meetingH,
      y0_overhead: meetingH,
      y1_overhead: meetingH + overheadH,
      y0_adHoc: meetingH + overheadH,
      y1_adHoc: meetingH + overheadH + adHocH,
      y0_project: meetingH + overheadH + adHocH,
      y1_project: meetingH + overheadH + adHocH + projectH,
    }
  })

  // Area generators
  const layers = [
    { key: 'meetings', color: CATEGORY_COLORS.meetings, y0: 'y0_meetings', y1: 'y1_meetings' },
    { key: 'overhead', color: CATEGORY_COLORS.overhead, y0: 'y0_overhead', y1: 'y1_overhead' },
    { key: 'adHoc', color: CATEGORY_COLORS.adHoc, y0: 'y0_adHoc', y1: 'y1_adHoc' },
    { key: 'project', color: CATEGORY_COLORS.project, y0: 'y0_project', y1: 'y1_project' },
  ] as const

  for (const layer of layers) {
    const area = d3.area<(typeof data)[number]>()
      .x((d) => x(d.label)!)
      .y0((d) => y((d as any)[layer.y0]))
      .y1((d) => y((d as any)[layer.y1]))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', layer.color)
      .attr('opacity', 0.7)
      .attr('stroke', layer.color)
      .attr('stroke-width', 1)
  }

  // Drag handles on boundary between ad-hoc and project time
  const handleGroup = g.append('g').attr('class', 'drag-handles')

  data.forEach((d, i) => {
    const cx = x(d.label)!
    const cy = y(d.y1_adHoc)

    const handle = handleGroup.append('circle')
      .attr('cx', cx)
      .attr('cy', cy)
      .attr('r', 6)
      .attr('fill', 'white')
      .attr('stroke', '#8a8078')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .attr('cursor', 'ns-resize')
      .on('mouseenter', function () {
        d3.select(this).attr('opacity', 1)
      })
      .on('mouseleave', function () {
        if (!dragState.value) {
          d3.select(this).attr('opacity', 0)
        }
      })

    // D3 drag behavior
    const drag = d3.drag<SVGCircleElement, unknown>()
      .on('start', () => {
        dragState.value = {
          dayIndex: i,
          field: 'adHocBoundary',
          startY: cy,
          startValue: d.adHoc,
        }
        handle.attr('opacity', 1)
      })
      .on('drag', (event) => {
        if (!dragState.value) return
        const newY = Math.max(y(maxHours.value), Math.min(y(0), event.y))
        handle.attr('cy', newY)

        const hoursAtNewY = y.invert(newY)
        const meetingsAndOverhead = d.meetings + d.overhead
        let newAdHoc = hoursAtNewY - meetingsAndOverhead
        newAdHoc = Math.max(0, newAdHoc)
        // Snap to 15min increments
        newAdHoc = Math.round(newAdHoc * 4) / 4

        emit('allocation-change', i, 'adHocBudget', newAdHoc)
      })
      .on('end', () => {
        dragState.value = null
        handle.attr('opacity', 0)
      })

    handle.call(drag as any)
  })

  // Hover interaction columns
  const hoverGroup = g.append('g').attr('class', 'hover-areas')
  const colWidth = innerWidth / data.length

  data.forEach((d, i) => {
    const cx = x(d.label)!

    hoverGroup.append('rect')
      .attr('x', cx - colWidth / 2)
      .attr('y', 0)
      .attr('width', colWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'pointer')
      .on('mouseenter', (event) => {
        hoverDayIndex.value = i
        showTooltip(event, d, i)
        // Show the drag handle
        handleGroup.selectAll('circle')
          .filter((_: unknown, idx: number) => idx === i)
          .attr('opacity', 1)
      })
      .on('mousemove', (event) => {
        moveTooltip(event)
      })
      .on('mouseleave', () => {
        hoverDayIndex.value = null
        hideTooltip()
        if (!dragState.value) {
          handleGroup.selectAll('circle').attr('opacity', 0)
        }
      })
  })
}

function showTooltip(event: MouseEvent, d: any, dayIndex: number) {
  const tooltip = tooltipRef.value
  if (!tooltip) return
  const day = props.weekData[dayIndex]
  const meetingH = getMeetingHours(day)

  tooltip.innerHTML = `
    <div style="font-weight:600;margin-bottom:4px">${d.label}</div>
    <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
      <span style="width:8px;height:8px;border-radius:2px;background:${CATEGORY_COLORS.meetings}"></span>
      Meetings: ${meetingH.toFixed(1)}h
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
      <span style="width:8px;height:8px;border-radius:2px;background:${CATEGORY_COLORS.overhead}"></span>
      Overhead: ${day.overhead.toFixed(1)}h
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
      <span style="width:8px;height:8px;border-radius:2px;background:${CATEGORY_COLORS.adHoc}"></span>
      Ad-hoc: ${day.adHocBudget.toFixed(1)}h
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin:2px 0">
      <span style="width:8px;height:8px;border-radius:2px;background:${CATEGORY_COLORS.project}"></span>
      Project: ${getProjectHours(day).toFixed(1)}h
    </div>
  `
  tooltip.style.opacity = '1'
  moveTooltip(event)
}

function moveTooltip(event: MouseEvent) {
  const tooltip = tooltipRef.value
  const container = containerRef.value
  if (!tooltip || !container) return
  const rect = container.getBoundingClientRect()
  tooltip.style.left = `${event.clientX - rect.left + 12}px`
  tooltip.style.top = `${event.clientY - rect.top - 10}px`
}

function hideTooltip() {
  const tooltip = tooltipRef.value
  if (tooltip) {
    tooltip.style.opacity = '0'
  }
}

onMounted(drawChart)
watch(() => [props.weekData, props.focusProjects], drawChart, { deep: true })
</script>

<template>
  <div ref="containerRef" class="stacked-area-chart">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      class="chart-svg"
    ></svg>
    <div ref="tooltipRef" class="chart-tooltip"></div>
  </div>
</template>

<style scoped>
.stacked-area-chart {
  position: relative;
  width: 100%;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}

.chart-tooltip {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: opacity 0.15s ease;
  z-index: 10;
  white-space: nowrap;
}
</style>
