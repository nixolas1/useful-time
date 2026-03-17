<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import * as d3 from 'd3'
import type { DayAllocation, Project } from '../../types'
import { CATEGORY_COLORS } from '../../types'

const props = defineProps<{
  dayData: DayAllocation
  focusProjects: Project[]
  workHours?: number
}>()

const emit = defineEmits<{
  'allocation-change': [field: 'overhead' | 'adHocBudget', value: number]
}>()

const svgRef = ref<SVGSVGElement | null>(null)

const size = 300
const outerRadius = size / 2 - 10
const innerRadius = outerRadius * 0.6
const maxHours = computed(() => props.workHours ?? 8)

function getMeetingHours(): number {
  return props.dayData.meetings.reduce((sum, m) => {
    const start = new Date(m.start).getTime()
    const end = new Date(m.end).getTime()
    return sum + (end - start) / (1000 * 60 * 60) + m.bufferBefore + m.bufferAfter
  }, 0)
}

function getProjectHours(): number {
  return props.dayData.projectAllocations.reduce((sum, a) => sum + a.hours, 0)
}

const availableProjectHours = computed(() => {
  const meetingH = getMeetingHours()
  return Math.max(0, maxHours.value - meetingH - props.dayData.overhead - props.dayData.adHocBudget)
})

function drawChart() {
  const svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()

  const g = svg
    .append('g')
    .attr('transform', `translate(${size / 2},${size / 2})`)

  const meetingH = getMeetingHours()
  const overheadH = props.dayData.overhead
  const adHocH = props.dayData.adHocBudget
  const projectH = getProjectHours()
  const total = meetingH + overheadH + adHocH + projectH

  if (total === 0) {
    // Draw empty state
    g.append('circle')
      .attr('r', outerRadius)
      .attr('fill', 'none')
      .attr('stroke', '#e8e0d4')
      .attr('stroke-width', outerRadius - innerRadius)
      .attr('stroke-dasharray', '4,4')

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('font-size', '20px')
      .attr('font-weight', '600')
      .attr('fill', '#2d2a26')
      .text(`${maxHours.value}h`)

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('font-size', '11px')
      .attr('fill', '#8a8078')
      .text('available')

    return
  }

  // Build segments
  type Segment = { value: number; color: string; label: string; draggable: boolean; field?: string }
  const segments: Segment[] = []

  if (meetingH > 0) {
    segments.push({ value: meetingH, color: CATEGORY_COLORS.meetings, label: 'Meetings', draggable: false })
  }
  if (overheadH > 0) {
    segments.push({ value: overheadH, color: CATEGORY_COLORS.overhead, label: 'Overhead', draggable: true, field: 'overhead' })
  }
  if (adHocH > 0) {
    segments.push({ value: adHocH, color: CATEGORY_COLORS.adHoc, label: 'Ad-hoc', draggable: true, field: 'adHocBudget' })
  }

  // Project time: subdivide by focus projects
  if (projectH > 0) {
    const allocations = props.dayData.projectAllocations
    for (const alloc of allocations) {
      if (alloc.hours <= 0) continue
      const proj = props.focusProjects.find((p) => p.id === alloc.projectId)
      segments.push({
        value: alloc.hours,
        color: proj?.color ?? CATEGORY_COLORS.project,
        label: proj?.name ?? 'Project',
        draggable: false,
      })
    }
    // Unallocated project time
    const allocatedH = allocations.reduce((s, a) => s + a.hours, 0)
    const unallocated = availableProjectHours.value - allocatedH
    if (unallocated > 0.01) {
      segments.push({
        value: unallocated,
        color: CATEGORY_COLORS.project,
        label: 'Unallocated',
        draggable: false,
      })
    }
  }

  const pie = d3.pie<Segment>()
    .value((d) => d.value)
    .sort(null)
    .padAngle(0.02)

  const arc = d3.arc<d3.PieArcDatum<Segment>>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(3)

  const arcs = pie(segments)

  // Draw arcs with transitions
  const arcPaths = g.selectAll('.arc')
    .data(arcs)
    .enter()
    .append('path')
    .attr('class', 'arc')
    .attr('d', arc)
    .attr('fill', (d) => d.data.color)
    .attr('opacity', 0.8)
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('cursor', (d) => d.data.draggable ? 'pointer' : 'default')

  // Hover effect
  arcPaths
    .on('mouseenter', function (_, d) {
      d3.select(this).attr('opacity', 1)
      showCenterText(d.data.label, d.data.value)
    })
    .on('mouseleave', function () {
      d3.select(this).attr('opacity', 0.8)
      showDefaultCenter()
    })

  // Drag for overhead and ad-hoc segments
  arcPaths.filter((d) => d.data.draggable).each(function (d) {
    const self = d3.select(this)
    const drag = d3.drag<SVGPathElement, unknown>()
      .on('start', () => {
        self.attr('opacity', 1)
      })
      .on('drag', (event) => {
        const dx = event.x
        const dy = event.y
        const angle = Math.atan2(dy, dx)
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < innerRadius * 0.5) return

        // Convert angle movement to hours change
        const midAngle = (d.startAngle + d.endAngle) / 2
        const angleDiff = angle - midAngle
        const hourChange = (angleDiff / (2 * Math.PI)) * total
        let newValue = d.data.value + hourChange
        newValue = Math.max(d.data.field === 'overhead' ? 0.5 : 0, newValue)
        newValue = Math.min(maxHours.value - getMeetingHours() - 0.5, newValue)
        newValue = Math.round(newValue * 4) / 4

        if (d.data.field) {
          emit('allocation-change', d.data.field as 'overhead' | 'adHocBudget', newValue)
        }
      })
      .on('end', () => {
        self.attr('opacity', 0.8)
      })

    d3.select(this).call(drag as any)
  })

  // Center text
  const centerGroup = g.append('g').attr('class', 'center-text')

  function showCenterText(label: string, value: number) {
    centerGroup.selectAll('*').remove()
    centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('font-size', '18px')
      .attr('font-weight', '600')
      .attr('fill', '#2d2a26')
      .text(`${value.toFixed(1)}h`)
    centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('font-size', '11px')
      .attr('fill', '#8a8078')
      .text(label)
  }

  function showDefaultCenter() {
    centerGroup.selectAll('*').remove()
    centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('font-size', '20px')
      .attr('font-weight', '600')
      .attr('fill', '#2d2a26')
      .text(`${availableProjectHours.value.toFixed(1)}h`)
    centerGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .attr('font-size', '11px')
      .attr('fill', '#8a8078')
      .text('project time')
  }

  showDefaultCenter()
}

onMounted(drawChart)
watch(() => [props.dayData, props.focusProjects], drawChart, { deep: true })
</script>

<template>
  <div class="donut-chart">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${size} ${size}`"
      preserveAspectRatio="xMidYMid meet"
      class="chart-svg"
    ></svg>
  </div>
</template>

<style scoped>
.donut-chart {
  position: relative;
  width: 100%;
  max-width: 300px;
}

.chart-svg {
  width: 100%;
  height: auto;
  display: block;
}
</style>
