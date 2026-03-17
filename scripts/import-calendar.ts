import * as fs from 'node:fs'
import { readData, writeData, getMonday, parseArgs } from './lib/data'
import type { Meeting } from '../src/types/index'
import { DEFAULT_DAY_DEFAULTS } from '../src/types/index'

interface IcsEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
}

function parseIcsFile(content: string): IcsEvent[] {
  const events: IcsEvent[] = []
  const blocks = content.split('BEGIN:VEVENT')
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0]
    const uid = extractField(block, 'UID')
    const summary = extractField(block, 'SUMMARY')
    const dtstart = extractField(block, 'DTSTART')
    const dtend = extractField(block, 'DTEND')
    if (uid && summary && dtstart && dtend) {
      events.push({
        uid,
        summary,
        dtstart: parseIcsDateTime(dtstart),
        dtend: parseIcsDateTime(dtend),
      })
    }
  }
  return events
}

function extractField(block: string, field: string): string | undefined {
  // Handle fields with parameters like DTSTART;TZID=America/New_York:20260314T100000
  const regex = new RegExp(`^${field}[;:](.*)$`, 'm')
  const match = block.match(regex)
  if (!match) return undefined
  const value = match[1]
  // If there are parameters (contains ':'), take the part after the last ':'
  const colonIdx = value.lastIndexOf(':')
  if (field === 'UID' || field === 'SUMMARY') {
    // For UID and SUMMARY, the value may contain colons - take everything after first match
    return value.trim()
  }
  if (colonIdx !== -1) {
    return value.slice(colonIdx + 1).trim()
  }
  return value.trim()
}

function parseIcsDateTime(raw: string): string {
  // Handle formats: 20260314T100000, 20260314T100000Z
  const cleaned = raw.replace(/Z$/, '').trim()
  if (cleaned.length >= 15) {
    const year = cleaned.slice(0, 4)
    const month = cleaned.slice(4, 6)
    const day = cleaned.slice(6, 8)
    const hour = cleaned.slice(9, 11)
    const min = cleaned.slice(11, 13)
    return `${year}-${month}-${day}T${hour}:${min}`
  }
  return raw
}

function getDateStr(isoDateTime: string): string {
  return isoDateTime.split('T')[0]
}

const args = parseArgs(process.argv)
const filePath = args['file']
const weekFilter = args['week'] ? getMonday(args['week']) : undefined

if (!filePath) {
  process.stderr.write('Error: --file PATH is required\n')
  process.exit(1)
}

if (!fs.existsSync(filePath)) {
  process.stderr.write(`Error: File not found: ${filePath}\n`)
  process.exit(1)
}

const icsContent = fs.readFileSync(filePath, 'utf-8')
const events = parseIcsFile(icsContent)

if (events.length === 0) {
  process.stderr.write('Error: No valid VEVENT blocks found in file\n')
  process.exit(1)
}

const data = readData()
const defaultBuffer = data.dayDefaults?.meetingBuffer ?? DEFAULT_DAY_DEFAULTS.meetingBuffer

let imported = 0
let skipped = 0
let updated = 0

for (const event of events) {
  const dateStr = getDateStr(event.dtstart)
  const eventWeek = getMonday(dateStr)

  // If week filter is set, skip events not in that week
  if (weekFilter && eventWeek !== weekFilter) {
    skipped++
    continue
  }

  // Find or create week plan
  let weekPlan = data.weekPlans.find((w) => w.weekStart === eventWeek)
  if (!weekPlan) {
    weekPlan = {
      weekStart: eventWeek,
      focusProjects: [],
      dailyAllocations: [],
    }
    data.weekPlans.push(weekPlan)
  }

  // Find or create day allocation
  let dayAlloc = weekPlan.dailyAllocations.find((d) => d.date === dateStr)
  if (!dayAlloc) {
    dayAlloc = {
      date: dateStr,
      meetings: [],
      overhead: data.dayDefaults?.overhead ?? DEFAULT_DAY_DEFAULTS.overhead,
      adHocBudget:
        data.dayDefaults?.adHocBudget ?? DEFAULT_DAY_DEFAULTS.adHocBudget,
      projectAllocations: [],
    }
    weekPlan.dailyAllocations.push(dayAlloc)
  }

  const meeting: Meeting = {
    id: event.uid,
    title: event.summary,
    start: event.dtstart,
    end: event.dtend,
    bufferBefore: defaultBuffer,
    bufferAfter: defaultBuffer,
  }

  // Check for duplicate by UID
  const existingIdx = dayAlloc.meetings.findIndex((m) => m.id === event.uid)
  if (existingIdx !== -1) {
    dayAlloc.meetings[existingIdx] = meeting
    updated++
  } else {
    dayAlloc.meetings.push(meeting)
    imported++
  }
}

writeData(data)

const output = { imported, skipped, updated }
process.stdout.write(JSON.stringify(output, null, 2) + '\n')
process.exit(0)
