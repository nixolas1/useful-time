<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import ProjectCard from '../components/projects/ProjectCard.vue'
import ProjectForm from '../components/projects/ProjectForm.vue'
import type { Project, DayDefaults, WeekPlan, DayAllocation, Meeting } from '../types'
import { DEFAULT_DAY_DEFAULTS } from '../types'
import { useStorage } from '../composables/useStorage'
import { parseICS } from '../utils/icsParser'

const router = useRouter()
const storage = useStorage()

const projects = ref<Project[]>(storage.get<Project[]>('projects') ?? [])
const dayDefaults = ref<DayDefaults>(storage.get<DayDefaults>('dayDefaults') ?? { ...DEFAULT_DAY_DEFAULTS })

const showProjectForm = ref(false)
const editingProject = ref<Project | null>(null)

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function saveProjects() {
  storage.set('projects', projects.value)
}

function saveDayDefaults() {
  storage.set('dayDefaults', dayDefaults.value)
}

function handleNewProject() {
  editingProject.value = null
  showProjectForm.value = true
}

function handleEditProject(project: Project) {
  editingProject.value = project
  showProjectForm.value = true
}

function handleDeleteProject(projectId: string) {
  projects.value = projects.value.filter((p) => p.id !== projectId)
  saveProjects()
}

function handleSaveProject(data: Omit<Project, 'id'> & { id?: string }) {
  if (data.id) {
    const idx = projects.value.findIndex((p) => p.id === data.id)
    if (idx !== -1) {
      projects.value[idx] = data as Project
    }
  } else {
    projects.value.push({ ...data, id: generateId() } as Project)
  }
  saveProjects()
  showProjectForm.value = false
  editingProject.value = null
}

function handleCancelForm() {
  showProjectForm.value = false
  editingProject.value = null
}

function handleExportJson() {
  const json = storage.exportAll()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `useful-time-export-${new Date().toISOString().split('T')[0]}.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

function handleImportJson(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      storage.importAll(reader.result as string)
      // Reload data
      projects.value = storage.get<Project[]>('projects') ?? []
      dayDefaults.value = storage.get<DayDefaults>('dayDefaults') ?? { ...DEFAULT_DAY_DEFAULTS }
    } catch (e) {
      console.error('Import failed:', e)
    }
  }
  reader.readAsText(file)
  input.value = ''
}

const importMessage = ref('')

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function handleIcsUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    const content = reader.result as string
    const events = parseICS(content)
    if (events.length === 0) {
      importMessage.value = 'No events found in the ICS file.'
      return
    }

    const buffer = dayDefaults.value.meetingBuffer
    let imported = 0
    let updated = 0
    let skipped = 0

    // Group events by week monday
    const byWeek = new Map<string, typeof events>()
    for (const ev of events) {
      const eventDate = ev.start.slice(0, 10)
      const d = new Date(eventDate + 'T12:00:00')
      const dayOfWeek = d.getDay()
      // Skip weekend events
      if (dayOfWeek === 0 || dayOfWeek === 6) { skipped++; continue }
      const monday = getMonday(eventDate)
      if (!byWeek.has(monday)) byWeek.set(monday, [])
      byWeek.get(monday)!.push(ev)
    }

    for (const [monday, weekEvents] of byWeek) {
      // Load or create week plan
      let plan = storage.get<WeekPlan>(`weekPlan:${monday}`)
      if (!plan) {
        const base = new Date(monday + 'T12:00:00')
        plan = {
          weekStart: monday,
          focusProjects: [],
          dailyAllocations: Array.from({ length: 5 }, (_, i) => {
            const d = new Date(base)
            d.setDate(d.getDate() + i)
            return {
              date: formatLocalDate(d),
              meetings: [],
              overhead: dayDefaults.value.overhead,
              adHocBudget: dayDefaults.value.adHocBudget,
              projectAllocations: [],
            } as DayAllocation
          }),
        }
      }

      for (const ev of weekEvents) {
        const eventDate = ev.start.slice(0, 10)
        const day = plan.dailyAllocations.find(d => d.date === eventDate)
        if (!day) { skipped++; continue }

        const meeting: Meeting = {
          id: ev.uid,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          bufferBefore: buffer,
          bufferAfter: buffer,
        }

        const existingIdx = day.meetings.findIndex(m => m.id === ev.uid)
        if (existingIdx !== -1) {
          day.meetings[existingIdx] = meeting
          updated++
        } else {
          day.meetings.push(meeting)
          imported++
        }
      }

      storage.set(`weekPlan:${monday}`, plan)
    }

    importMessage.value = `Imported ${imported} meetings, updated ${updated}, skipped ${skipped}.`
  }
  reader.readAsText(file)
  input.value = ''
}

function goBack() {
  router.back()
}

const activeProjects = computed(() => projects.value.filter((p) => p.status === 'active'))
const archivedProjects = computed(() => projects.value.filter((p) => p.status !== 'active'))
</script>

<template>
  <div class="settings-view">
    <header class="settings-header">
      <button class="back-btn" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back
      </button>
      <h1 class="settings-title">Settings</h1>
    </header>

    <main class="settings-content">
      <!-- Projects Section -->
      <section class="settings-section">
        <div class="section-header">
          <h2 class="section-title">Projects</h2>
          <button class="new-project-btn" @click="handleNewProject">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            New Project
          </button>
        </div>

        <div v-if="activeProjects.length > 0" class="projects-grid">
          <ProjectCard
            v-for="project in activeProjects"
            :key="project.id"
            :project="project"
            @edit="handleEditProject"
            @delete="handleDeleteProject"
          />
        </div>
        <p v-else class="empty-state">No active projects. Create one to get started.</p>

        <div v-if="archivedProjects.length > 0" class="archived-section">
          <h3 class="subsection-title">Paused / Completed</h3>
          <div class="projects-grid">
            <ProjectCard
              v-for="project in archivedProjects"
              :key="project.id"
              :project="project"
              @edit="handleEditProject"
              @delete="handleDeleteProject"
            />
          </div>
        </div>
      </section>

      <!-- Day Defaults Section -->
      <section class="settings-section">
        <h2 class="section-title">Day Defaults</h2>
        <div class="defaults-form">
          <div class="form-field">
            <label class="field-label">Work Hours</label>
            <input
              v-model.number="dayDefaults.workHours"
              type="number"
              min="1"
              max="12"
              step="0.5"
              class="field-input compact"
              @change="saveDayDefaults"
            />
          </div>
          <div class="form-field">
            <label class="field-label">Workday Start</label>
            <input
              v-model="dayDefaults.workdayStart"
              type="time"
              class="field-input compact"
              @change="saveDayDefaults"
            />
          </div>
          <div class="form-field">
            <label class="field-label">Overhead Budget (hours)</label>
            <input
              v-model.number="dayDefaults.overhead"
              type="number"
              min="0"
              max="8"
              step="0.25"
              class="field-input compact"
              @change="saveDayDefaults"
            />
          </div>
          <div class="form-field">
            <label class="field-label">Ad-hoc Budget (hours)</label>
            <input
              v-model.number="dayDefaults.adHocBudget"
              type="number"
              min="0"
              max="8"
              step="0.25"
              class="field-input compact"
              @change="saveDayDefaults"
            />
          </div>
          <div class="form-field">
            <label class="field-label">Meeting Buffer (minutes)</label>
            <input
              :value="Math.round(dayDefaults.meetingBuffer * 60)"
              type="number"
              min="0"
              max="60"
              step="5"
              class="field-input compact"
              @change="(e: Event) => { dayDefaults.meetingBuffer = Number((e.target as HTMLInputElement).value) / 60; saveDayDefaults() }"
            />
          </div>
        </div>
      </section>

      <!-- Import/Export Section -->
      <section class="settings-section">
        <h2 class="section-title">Data</h2>
        <div class="data-actions">
          <div class="data-action">
            <h3 class="action-title">Import Calendar</h3>
            <p class="action-desc">Upload an ICS file to import meetings.</p>
            <label class="file-btn">
              Upload .ics
              <input type="file" accept=".ics" class="sr-only" @change="handleIcsUpload" />
            </label>
            <p v-if="importMessage" class="import-message">{{ importMessage }}</p>
          </div>
          <div class="data-action">
            <h3 class="action-title">Export Data</h3>
            <p class="action-desc">Download all your data as JSON.</p>
            <button class="file-btn" @click="handleExportJson">Export JSON</button>
          </div>
          <div class="data-action">
            <h3 class="action-title">Import Data</h3>
            <p class="action-desc">Restore from a previous export.</p>
            <label class="file-btn">
              Import JSON
              <input type="file" accept=".json" class="sr-only" @change="handleImportJson" />
            </label>
          </div>
        </div>
      </section>
    </main>

    <!-- Project Form Modal -->
    <Teleport to="body">
      <div v-if="showProjectForm" class="modal-overlay" @click.self="handleCancelForm">
        <div class="modal-content">
          <ProjectForm
            :project="editingProject"
            @save="handleSaveProject"
            @cancel="handleCancelForm"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.settings-view {
  min-height: 100vh;
  background: var(--color-bg);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-lg) var(--space-2xl);
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.back-btn:hover {
  color: var(--color-text);
  background: var(--color-bg);
}

.settings-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
}

.settings-content {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-2xl);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text);
}

.subsection-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.new-project-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all 0.15s ease;
}

.new-project-btn:hover {
  background: var(--color-bg);
  border-color: var(--color-text-muted);
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-lg);
}

.archived-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-border);
}

.empty-state {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  font-style: italic;
  padding: var(--space-xl) 0;
}

.defaults-form {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
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
  background: var(--color-bg);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  transition: border-color 0.15s ease;
}

.field-input:focus {
  outline: none;
  border-color: var(--color-text-muted);
}

.field-input.compact {
  max-width: 160px;
}

.data-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-lg);
}

.data-action {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.action-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
}

.action-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
  flex: 1;
}

.file-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-sm) var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.file-btn:hover {
  background: var(--color-bg);
  border-color: var(--color-text-muted);
}

.import-message {
  font-size: var(--font-size-xs);
  color: var(--color-success);
  font-weight: 500;
  margin-top: var(--space-xs);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-2xl);
}

.modal-content {
  background: var(--color-bg-card);
  border-radius: var(--radius-xl);
  padding: var(--space-2xl);
  max-width: 520px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}
</style>
