import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import { useTimeCalculator } from '../useTimeCalculator'
import type { Meeting, DayDefaults } from '../../types'
import { DEFAULT_DAY_DEFAULTS } from '../../types'

function makeMeeting(overrides: Partial<Meeting> & { start: string; end: string }): Meeting {
  return {
    id: overrides.id ?? 'mtg-1',
    title: overrides.title ?? 'Meeting',
    start: overrides.start,
    end: overrides.end,
    bufferBefore: overrides.bufferBefore ?? 0.25,
    bufferAfter: overrides.bufferAfter ?? 0.25,
  }
}

describe('useTimeCalculator', () => {
  it('computes available time with no meetings', () => {
    const meetings = ref<Meeting[]>([])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { availableProjectTime } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    expect(availableProjectTime.value).toBe(5)
  })

  it('reacts to meeting changes', () => {
    const meetings = ref<Meeting[]>([])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { availableProjectTime } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    expect(availableProjectTime.value).toBe(5)

    // Add a 1h meeting
    meetings.value = [
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T11:00' }),
    ]
    // 8 - 1.5 - 1.5 - (1 + 0.5) = 3.5
    expect(availableProjectTime.value).toBe(3.5)
  })

  it('reacts to overhead changes', () => {
    const meetings = ref<Meeting[]>([])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { availableProjectTime } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    overhead.value = 3
    // Uses defaults.overhead in the formula via calculateAvailableTime.
    // We pass overhead as a ref that overrides defaults.overhead
    expect(availableProjectTime.value).toBe(3.5) // 8 - 3 - 1.5 - 0
  })

  it('reacts to adHocBudget changes', () => {
    const meetings = ref<Meeting[]>([])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { availableProjectTime } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    adHocBudget.value = 0
    expect(availableProjectTime.value).toBe(6.5) // 8 - 1.5 - 0 - 0
  })

  it('exposes meetingHours computed', () => {
    const meetings = ref<Meeting[]>([
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T11:30' }),
    ])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { meetingHours } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    expect(meetingHours.value).toBe(1.5)
  })

  it('exposes bufferHours computed', () => {
    const meetings = ref<Meeting[]>([
      makeMeeting({ start: '2026-03-14T10:00', end: '2026-03-14T11:00' }),
    ])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { bufferHours } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    expect(bufferHours.value).toBe(0.5) // 0.25 + 0.25
  })

  it('clamps available time to zero', () => {
    const meetings = ref<Meeting[]>([
      makeMeeting({ id: 'a', start: '2026-03-14T09:00', end: '2026-03-14T14:00' }),
      makeMeeting({ id: 'b', start: '2026-03-14T14:00', end: '2026-03-14T17:00' }),
    ])
    const overhead = ref(1.5)
    const adHocBudget = ref(1.5)
    const defaults = ref<DayDefaults>(DEFAULT_DAY_DEFAULTS)

    const { availableProjectTime } = useTimeCalculator(
      meetings,
      overhead,
      adHocBudget,
      defaults,
    )

    expect(availableProjectTime.value).toBe(0)
  })
})
