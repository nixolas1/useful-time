import type { StorageAdapter } from '../types'

const STORAGE_PREFIX = 'useful-time:'

export class LocalStorageAdapter implements StorageAdapter {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  }

  exportAll(): string {
    const data: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i)
      if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
        const key = fullKey.slice(STORAGE_PREFIX.length)
        const raw = localStorage.getItem(fullKey)
        if (raw !== null) {
          try {
            data[key] = JSON.parse(raw)
          } catch {
            data[key] = raw
          }
        }
      }
    }
    return JSON.stringify(data, null, 2)
  }

  importAll(json: string): void {
    const data = JSON.parse(json) as Record<string, unknown>
    // Clear existing prefixed keys
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i)
      if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(fullKey)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))

    // Import new data
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
    }
  }
}

export function useStorage(): StorageAdapter {
  return new LocalStorageAdapter()
}
