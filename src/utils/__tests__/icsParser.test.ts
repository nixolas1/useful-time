import { describe, it, expect } from 'vitest'
import { parseICS } from '../icsParser'

const validICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-001
SUMMARY:Team Standup
DTSTART:20260314T090000Z
DTEND:20260314T093000Z
END:VEVENT
END:VCALENDAR`

const multipleEvents = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-001
SUMMARY:Team Standup
DTSTART:20260314T090000Z
DTEND:20260314T093000Z
END:VEVENT
BEGIN:VEVENT
UID:event-002
SUMMARY:Design Review
DTSTART:20260314T140000
DTEND:20260314T150000
END:VEVENT
END:VCALENDAR`

const malformedEvents = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-001
SUMMARY:Good Event
DTSTART:20260314T090000Z
DTEND:20260314T093000Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:Missing UID and times
END:VEVENT
BEGIN:VEVENT
UID:event-003
DTSTART:20260314T100000Z
END:VEVENT
END:VCALENDAR`

const duplicateUIDs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-001
SUMMARY:First Version
DTSTART:20260314T090000Z
DTEND:20260314T093000Z
END:VEVENT
BEGIN:VEVENT
UID:event-001
SUMMARY:Updated Version
DTSTART:20260314T100000Z
DTEND:20260314T110000Z
END:VEVENT
END:VCALENDAR`

describe('parseICS', () => {
  it('parses a valid ICS file with one event', () => {
    const events = parseICS(validICS)
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('event-001')
    expect(events[0].title).toBe('Team Standup')
    expect(events[0].start).toContain('2026-03-14')
    expect(events[0].end).toContain('2026-03-14')
  })

  it('parses multiple events', () => {
    const events = parseICS(multipleEvents)
    expect(events).toHaveLength(2)
    expect(events[0].uid).toBe('event-001')
    expect(events[1].uid).toBe('event-002')
  })

  it('handles both datetime formats (with and without Z)', () => {
    const events = parseICS(multipleEvents)
    // First event has Z suffix, second doesn't
    expect(events[0].start).toBeTruthy()
    expect(events[1].start).toBeTruthy()
    // Both should parse to valid dates
    expect(new Date(events[0].start).toString()).not.toBe('Invalid Date')
    expect(new Date(events[1].start).toString()).not.toBe('Invalid Date')
  })

  it('skips malformed events (missing UID, DTSTART, or DTEND)', () => {
    const events = parseICS(malformedEvents)
    // Only the first event is fully valid
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('event-001')
  })

  it('handles duplicate UIDs - last one wins', () => {
    const events = parseICS(duplicateUIDs)
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('event-001')
    expect(events[0].title).toBe('Updated Version')
  })

  it('returns empty array for empty input', () => {
    expect(parseICS('')).toEqual([])
  })

  it('returns empty array for non-ICS content', () => {
    expect(parseICS('just some random text')).toEqual([])
  })

  it('extracts correct start and end times', () => {
    const events = parseICS(validICS)
    const start = new Date(events[0].start)
    const end = new Date(events[0].end)
    // End should be after start
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('handles CRLF line endings', () => {
    const crlfICS = validICS.replace(/\n/g, '\r\n')
    const events = parseICS(crlfICS)
    expect(events).toHaveLength(1)
    expect(events[0].uid).toBe('event-001')
  })
})
