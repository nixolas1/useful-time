export interface Project {
  id: string
  name: string
  color: string
  startDate: string
  endDate: string
  status: 'active' | 'paused' | 'completed'
  tasks: Task[]
}

export interface Task {
  id: string
  name: string
  estimatedHours: number
  status: 'todo' | 'in_progress' | 'done'
}

export interface WeekPlan {
  weekStart: string
  focusProjects: string[]
  dailyAllocations: DayAllocation[]
}

export interface DayAllocation {
  date: string
  meetings: Meeting[]
  overhead: number
  adHocBudget: number
  projectAllocations: { projectId: string; hours: number }[]
}

export interface Meeting {
  id: string
  title: string
  start: string
  end: string
  bufferBefore: number
  bufferAfter: number
}

export interface DayDefaults {
  workHours: number
  workdayStart: string
  overhead: number
  adHocBudget: number
  meetingBuffer: number
}

export interface StorageAdapter {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  exportAll(): string
  importAll(json: string): void
}

export interface AppData {
  projects: Project[]
  weekPlans: WeekPlan[]
  dayDefaults: DayDefaults
}

export const DEFAULT_DAY_DEFAULTS: DayDefaults = {
  workHours: 8,
  workdayStart: '09:00',
  overhead: 1.5,
  adHocBudget: 1.5,
  meetingBuffer: 0.25,
}

export const PROJECT_PALETTE = [
  '#b8e6c8', '#c8b8f4', '#f4c8d4', '#c8e0f4',
  '#e0d4a4', '#d4c8e8', '#a4d8d8', '#e8c8a4',
]

export const CATEGORY_COLORS = {
  meetings: '#f4a4a4',
  overhead: '#f4d4a4',
  adHoc: '#a4c8f4',
  project: '#b8e6c8',
}
