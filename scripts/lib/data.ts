import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AppData } from '../../src/types/index'
import { DEFAULT_DAY_DEFAULTS } from '../../src/types/index'

const DATA_PATH = path.join(process.cwd(), 'data', 'useful-time.json')

export function readData(): AppData {
  if (!fs.existsSync(DATA_PATH)) {
    return {
      projects: [],
      weekPlans: [],
      dayDefaults: { ...DEFAULT_DAY_DEFAULTS },
    }
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as Partial<AppData>
  return {
    projects: parsed.projects ?? [],
    weekPlans: parsed.weekPlans ?? [],
    dayDefaults: parsed.dayDefaults ?? { ...DEFAULT_DAY_DEFAULTS },
  }
}

export function writeData(data: AppData): void {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export function getMonday(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + 'T00:00:00') : new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  const yyyy = monday.getFullYear()
  const mm = String(monday.getMonth() + 1).padStart(2, '0')
  const dd = String(monday.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('--')) {
        args[key] = next
        i++
      } else {
        args[key] = 'true'
      }
    }
  }
  return args
}
