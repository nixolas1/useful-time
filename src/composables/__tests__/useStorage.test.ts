import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorageAdapter } from '../useStorage'

describe('LocalStorageAdapter', () => {
  let storage: LocalStorageAdapter

  beforeEach(() => {
    localStorage.clear()
    storage = new LocalStorageAdapter()
  })

  describe('get/set', () => {
    it('returns null for missing keys', () => {
      expect(storage.get('nonexistent')).toBeNull()
    })

    it('stores and retrieves a string value', () => {
      storage.set('name', 'test')
      expect(storage.get<string>('name')).toBe('test')
    })

    it('stores and retrieves an object', () => {
      const obj = { id: '1', name: 'Project', tasks: [] }
      storage.set('project', obj)
      expect(storage.get('project')).toEqual(obj)
    })

    it('stores and retrieves a number', () => {
      storage.set('count', 42)
      expect(storage.get<number>('count')).toBe(42)
    })

    it('stores and retrieves an array', () => {
      const arr = [1, 2, 3]
      storage.set('items', arr)
      expect(storage.get('items')).toEqual(arr)
    })

    it('overwrites existing values', () => {
      storage.set('key', 'first')
      storage.set('key', 'second')
      expect(storage.get<string>('key')).toBe('second')
    })

    it('uses prefixed keys in localStorage', () => {
      storage.set('mykey', 'value')
      expect(localStorage.getItem('useful-time:mykey')).toBe('"value"')
    })

    it('returns null for corrupted JSON', () => {
      localStorage.setItem('useful-time:bad', '{invalid json')
      expect(storage.get('bad')).toBeNull()
    })
  })

  describe('exportAll', () => {
    it('exports all prefixed data as JSON string', () => {
      storage.set('projects', [{ id: '1' }])
      storage.set('settings', { workHours: 8 })

      const exported = storage.exportAll()
      const parsed = JSON.parse(exported)

      expect(parsed.projects).toEqual([{ id: '1' }])
      expect(parsed.settings).toEqual({ workHours: 8 })
    })

    it('returns empty object when no data exists', () => {
      const exported = storage.exportAll()
      expect(JSON.parse(exported)).toEqual({})
    })

    it('ignores non-prefixed localStorage entries', () => {
      localStorage.setItem('other-app:key', 'value')
      storage.set('mykey', 'myvalue')

      const parsed = JSON.parse(storage.exportAll())
      expect(parsed).toEqual({ mykey: 'myvalue' })
      expect(parsed['other-app:key']).toBeUndefined()
    })
  })

  describe('importAll', () => {
    it('imports data and makes it retrievable', () => {
      const data = { projects: [{ id: '1' }], settings: { workHours: 8 } }
      storage.importAll(JSON.stringify(data))

      expect(storage.get('projects')).toEqual([{ id: '1' }])
      expect(storage.get('settings')).toEqual({ workHours: 8 })
    })

    it('clears existing prefixed data before import', () => {
      storage.set('old', 'data')
      storage.importAll(JSON.stringify({ new: 'data' }))

      expect(storage.get('old')).toBeNull()
      expect(storage.get<string>('new')).toBe('data')
    })

    it('does not affect non-prefixed localStorage entries', () => {
      localStorage.setItem('other-app:key', 'value')
      storage.importAll(JSON.stringify({ mykey: 'myvalue' }))

      expect(localStorage.getItem('other-app:key')).toBe('value')
    })

    it('roundtrips with exportAll', () => {
      storage.set('projects', [{ id: '1', name: 'Test' }])
      storage.set('defaults', { workHours: 8 })

      const exported = storage.exportAll()

      localStorage.clear()
      storage.importAll(exported)

      expect(storage.get('projects')).toEqual([{ id: '1', name: 'Test' }])
      expect(storage.get('defaults')).toEqual({ workHours: 8 })
    })

    it('throws on invalid JSON', () => {
      expect(() => storage.importAll('not json')).toThrow()
    })
  })
})
