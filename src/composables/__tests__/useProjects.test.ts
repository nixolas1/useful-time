import { describe, it, expect, beforeEach } from 'vitest'
import { useProjects } from '../useProjects'
import type { StorageAdapter, Project } from '../../types'
import { PROJECT_PALETTE } from '../../types'

function createMockStorage(): StorageAdapter {
  const store: Record<string, unknown> = {}
  return {
    get<T>(key: string): T | null {
      return (store[key] as T) ?? null
    },
    set<T>(key: string, value: T): void {
      store[key] = value
    },
    exportAll(): string {
      return JSON.stringify(store)
    },
    importAll(json: string): void {
      const data = JSON.parse(json)
      Object.assign(store, data)
    },
  }
}

describe('useProjects', () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = createMockStorage()
  })

  describe('initialization', () => {
    it('starts with empty projects list', () => {
      const { projects } = useProjects(storage)
      expect(projects.value).toEqual([])
    })

    it('loads existing projects from storage', () => {
      const existing: Project[] = [
        {
          id: 'p1',
          name: 'Test',
          color: '#b8e6c8',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
          status: 'active',
          tasks: [],
        },
      ]
      storage.set('projects', existing)
      const { projects } = useProjects(storage)
      expect(projects.value).toHaveLength(1)
      expect(projects.value[0].name).toBe('Test')
    })
  })

  describe('addProject', () => {
    it('creates a project with auto-assigned color', () => {
      const { addProject, projects } = useProjects(storage)
      addProject({ name: 'Project A', startDate: '2026-03-01', endDate: '2026-03-31' })
      expect(projects.value).toHaveLength(1)
      expect(projects.value[0].color).toBe(PROJECT_PALETTE[0])
      expect(projects.value[0].name).toBe('Project A')
      expect(projects.value[0].status).toBe('active')
      expect(projects.value[0].tasks).toEqual([])
    })

    it('cycles colors through palette', () => {
      const { addProject, projects } = useProjects(storage)
      for (let i = 0; i < PROJECT_PALETTE.length + 2; i++) {
        addProject({
          name: `Project ${i}`,
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        })
      }
      expect(projects.value[PROJECT_PALETTE.length].color).toBe(PROJECT_PALETTE[0])
      expect(projects.value[PROJECT_PALETTE.length + 1].color).toBe(PROJECT_PALETTE[1])
    })

    it('generates unique IDs', () => {
      const { addProject, projects } = useProjects(storage)
      addProject({ name: 'A', startDate: '2026-03-01', endDate: '2026-03-31' })
      addProject({ name: 'B', startDate: '2026-03-01', endDate: '2026-03-31' })
      expect(projects.value[0].id).not.toBe(projects.value[1].id)
    })

    it('persists to storage', () => {
      const { addProject } = useProjects(storage)
      addProject({ name: 'Persisted', startDate: '2026-03-01', endDate: '2026-03-31' })
      const stored = storage.get<Project[]>('projects')
      expect(stored).toHaveLength(1)
      expect(stored![0].name).toBe('Persisted')
    })

    it('validates name is not empty', () => {
      const { addProject } = useProjects(storage)
      expect(() => addProject({ name: '', startDate: '2026-03-01', endDate: '2026-03-31' })).toThrow()
    })

    it('validates endDate is after startDate', () => {
      const { addProject } = useProjects(storage)
      expect(() =>
        addProject({ name: 'Bad', startDate: '2026-03-31', endDate: '2026-03-01' }),
      ).toThrow()
    })
  })

  describe('updateProject', () => {
    it('updates project fields', () => {
      const { addProject, updateProject, projects } = useProjects(storage)
      addProject({ name: 'Original', startDate: '2026-03-01', endDate: '2026-03-31' })
      const id = projects.value[0].id
      updateProject(id, { name: 'Updated' })
      expect(projects.value[0].name).toBe('Updated')
    })

    it('persists updates to storage', () => {
      const { addProject, updateProject, projects } = useProjects(storage)
      addProject({ name: 'Original', startDate: '2026-03-01', endDate: '2026-03-31' })
      const id = projects.value[0].id
      updateProject(id, { status: 'paused' })
      const stored = storage.get<Project[]>('projects')
      expect(stored![0].status).toBe('paused')
    })

    it('throws for non-existent project', () => {
      const { updateProject } = useProjects(storage)
      expect(() => updateProject('nonexistent', { name: 'Nope' })).toThrow()
    })
  })

  describe('deleteProject', () => {
    it('removes the project', () => {
      const { addProject, deleteProject, projects } = useProjects(storage)
      addProject({ name: 'To Delete', startDate: '2026-03-01', endDate: '2026-03-31' })
      const id = projects.value[0].id
      deleteProject(id)
      expect(projects.value).toHaveLength(0)
    })

    it('persists deletion', () => {
      const { addProject, deleteProject, projects } = useProjects(storage)
      addProject({ name: 'To Delete', startDate: '2026-03-01', endDate: '2026-03-31' })
      deleteProject(projects.value[0].id)
      const stored = storage.get<Project[]>('projects')
      expect(stored).toHaveLength(0)
    })
  })

  describe('task management', () => {
    it('adds a task to a project', () => {
      const { addProject, addTask, projects } = useProjects(storage)
      addProject({ name: 'P', startDate: '2026-03-01', endDate: '2026-03-31' })
      const pid = projects.value[0].id
      addTask(pid, { name: 'Task 1', estimatedHours: 4 })
      expect(projects.value[0].tasks).toHaveLength(1)
      expect(projects.value[0].tasks[0].name).toBe('Task 1')
      expect(projects.value[0].tasks[0].status).toBe('todo')
    })

    it('updates a task', () => {
      const { addProject, addTask, updateTask, projects } = useProjects(storage)
      addProject({ name: 'P', startDate: '2026-03-01', endDate: '2026-03-31' })
      const pid = projects.value[0].id
      addTask(pid, { name: 'Task 1', estimatedHours: 4 })
      const tid = projects.value[0].tasks[0].id
      updateTask(pid, tid, { status: 'done' })
      expect(projects.value[0].tasks[0].status).toBe('done')
    })

    it('deletes a task', () => {
      const { addProject, addTask, deleteTask, projects } = useProjects(storage)
      addProject({ name: 'P', startDate: '2026-03-01', endDate: '2026-03-31' })
      const pid = projects.value[0].id
      addTask(pid, { name: 'Task 1', estimatedHours: 4 })
      const tid = projects.value[0].tasks[0].id
      deleteTask(pid, tid)
      expect(projects.value[0].tasks).toHaveLength(0)
    })
  })
})
