export interface ParsedEvent {
  uid: string
  title: string
  start: string
  end: string
}

/**
 * Parse an ICS datetime string (e.g. "20260314T090000Z" or "20260314T090000")
 * into an ISO datetime string.
 */
function parseICSDateTime(raw: string): string {
  // Format: YYYYMMDDTHHmmss[Z]
  const cleaned = raw.trim()
  const match = cleaned.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/,
  )
  if (!match) return ''
  const [, year, month, day, hour, min, sec, z] = match
  return `${year}-${month}-${day}T${hour}:${min}:${sec}${z || ''}`
}

/**
 * Parse an ICS/iCalendar string and extract VEVENT blocks.
 *
 * Returns an array of parsed events. Events missing UID, DTSTART, or DTEND
 * are skipped. Duplicate UIDs are deduplicated (last occurrence wins).
 */
export function parseICS(icsContent: string): ParsedEvent[] {
  if (!icsContent || !icsContent.includes('BEGIN:VEVENT')) {
    return []
  }

  // Normalize line endings
  const normalized = icsContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Unfold continuation lines (RFC 5545: lines starting with space/tab are continuations)
  const rawLines = normalized.split('\n')
  const unfoldedLines: string[] = []
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && unfoldedLines.length > 0) {
      unfoldedLines[unfoldedLines.length - 1] += line.slice(1)
    } else {
      unfoldedLines.push(line)
    }
  }

  // Extract VEVENT blocks
  const eventBlocks: string[] = []
  const lines = unfoldedLines
  let inEvent = false
  let currentBlock: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      currentBlock = []
    } else if (trimmed === 'END:VEVENT') {
      if (inEvent) {
        eventBlocks.push(currentBlock.join('\n'))
      }
      inEvent = false
    } else if (inEvent) {
      currentBlock.push(trimmed)
    }
  }

  // Parse each block
  const eventsMap = new Map<string, ParsedEvent>()

  for (const block of eventBlocks) {
    const blockLines = block.split('\n')
    let uid = ''
    let summary = ''
    let dtstart = ''
    let dtend = ''

    for (const line of blockLines) {
      if (line.startsWith('UID:')) {
        uid = line.slice(4).trim()
      } else if (line.startsWith('SUMMARY:')) {
        summary = line.slice(8).trim()
      } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
        // Skip all-day events (VALUE=DATE without time)
        if (line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME')) continue
        // Handle DTSTART:value or DTSTART;params:value
        const colonIdx = line.indexOf(':')
        if (colonIdx !== -1) {
          dtstart = parseICSDateTime(line.slice(colonIdx + 1).trim())
        }
      } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
        if (line.includes('VALUE=DATE') && !line.includes('VALUE=DATE-TIME')) continue
        const colonIdx = line.indexOf(':')
        if (colonIdx !== -1) {
          dtend = parseICSDateTime(line.slice(colonIdx + 1).trim())
        }
      }
    }

    // Skip events missing required fields
    if (!uid || !dtstart || !dtend) continue

    eventsMap.set(uid, {
      uid,
      title: summary || '(No Title)',
      start: dtstart,
      end: dtend,
    })
  }

  return Array.from(eventsMap.values())
}
