import { ref } from 'vue'
import type { StorageAdapter, Project, Task } from '../types'
import { PROJECT_PALETTE } from '../types'

const STORAGE_KEY = 'projects'

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function useProjects(storage: StorageAdapter) {
  const projects = ref<Project[]>(storage.get<Project[]>(STORAGE_KEY) ?? [])

  function persist() {
    storage.set(STORAGE_KEY, projects.value)
  }

  function getNextColor(): string {
    const idx = projects.value.length % PROJECT_PALETTE.length
    return PROJECT_PALETTE[idx]
  }

  function addProject(input: {
    name: string
    startDate: string
    endDate: string
  }): Project {
    if (!input.name.trim()) {
      throw new Error('Project name cannot be empty')
    }
    if (input.endDate < input.startDate) {
      throw new Error('End date must be after start date')
    }

    const project: Project = {
      id: generateId(),
      name: input.name.trim(),
      color: getNextColor(),
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'active',
      tasks: [],
    }

    projects.value.push(project)
    persist()
    return project
  }

  function updateProject(
    id: string,
    updates: Partial<Omit<Project, 'id'>>,
  ): void {
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Project not found: ${id}`)

    projects.value[idx] = { ...projects.value[idx], ...updates }
    persist()
  }

  function deleteProject(id: string): void {
    const idx = projects.value.findIndex((p) => p.id === id)
    if (idx === -1) throw new Error(`Project not found: ${id}`)

    projects.value.splice(idx, 1)
    persist()
  }

  function addTask(
    projectId: string,
    input: { name: string; estimatedHours: number },
  ): Task {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)

    const task: Task = {
      id: generateId(),
      name: input.name,
      estimatedHours: input.estimatedHours,
      status: 'todo',
    }

    project.tasks.push(task)
    persist()
    return task
  }

  function updateTask(
    projectId: string,
    taskId: string,
    updates: Partial<Omit<Task, 'id'>>,
  ): void {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)

    const idx = project.tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) throw new Error(`Task not found: ${taskId}`)

    project.tasks[idx] = { ...project.tasks[idx], ...updates }
    persist()
  }

  function deleteTask(projectId: string, taskId: string): void {
    const project = projects.value.find((p) => p.id === projectId)
    if (!project) throw new Error(`Project not found: ${projectId}`)

    const idx = project.tasks.findIndex((t) => t.id === taskId)
    if (idx === -1) throw new Error(`Task not found: ${taskId}`)

    project.tasks.splice(idx, 1)
    persist()
  }

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
  }
}
