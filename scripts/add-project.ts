import { readData, writeData, parseArgs } from './lib/data'
import type { Project } from '../src/types/index'
import { PROJECT_PALETTE } from '../src/types/index'

function generateId(): string {
  const hex = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, '0')
  return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`
}

function isValidDate(str: string): boolean {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(str)
  if (!match) return false
  const d = new Date(str + 'T00:00:00')
  return !isNaN(d.getTime())
}

function isValidHex(str: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(str)
}

const args = parseArgs(process.argv)

const name = args['name']
const start = args['start']
const end = args['end']
const color = args['color']

if (!name || name.trim().length === 0) {
  process.stderr.write('Error: --name is required and cannot be empty\n')
  process.exit(1)
}

if (!start || !isValidDate(start)) {
  process.stderr.write(
    'Error: --start is required and must be a valid YYYY-MM-DD date\n'
  )
  process.exit(1)
}

if (!end || !isValidDate(end)) {
  process.stderr.write(
    'Error: --end is required and must be a valid YYYY-MM-DD date\n'
  )
  process.exit(1)
}

if (new Date(end) < new Date(start)) {
  process.stderr.write('Error: --end must be on or after --start\n')
  process.exit(1)
}

if (color && !isValidHex(color)) {
  process.stderr.write(
    'Error: --color must be a valid hex color (e.g., #a1b2c3)\n'
  )
  process.exit(1)
}

const data = readData()

const assignedColor =
  color ?? PROJECT_PALETTE[data.projects.length % PROJECT_PALETTE.length]

const project: Project = {
  id: generateId(),
  name: name.trim(),
  color: assignedColor,
  startDate: start,
  endDate: end,
  status: 'active',
  tasks: [],
}

data.projects.push(project)
writeData(data)

process.stdout.write(JSON.stringify(project, null, 2) + '\n')
process.exit(0)
