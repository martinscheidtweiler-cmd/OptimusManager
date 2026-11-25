const ZONE = 'Europe/Brussels'
const dayRanges = new Map<string, { start: number; end: number }>()

export type StaffEntryInterval = {
  id: string
  shift_id: string
  task_id: number
  started_at: string
  ended_at: string | null
}

function parseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number)
  return { year, month, date }
}

/** Converts local midnight in Europe/Brussels to an absolute instant, including DST changes. */
function brusselsMidnight(day: string): number {
  const { year, month, date } = parseDay(day)
  const target = Date.UTC(year, month - 1, date, 0, 0, 0)
  let guess = target
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  })
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(p => [p.type, p.value]))
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second))
    guess += target - represented
  }
  return guess
}

export function nextBrusselsDay(day: string): string {
  const { year, month, date } = parseDay(day)
  const next = new Date(Date.UTC(year, month - 1, date + 1))
  return [next.getUTCFullYear(), String(next.getUTCMonth() + 1).padStart(2, '0'),
    String(next.getUTCDate()).padStart(2, '0')].join('-')
}

export function brusselsDayRange(day: string) {
  const cached = dayRanges.get(day)
  if (cached) return cached
  const range = { start: brusselsMidnight(day), end: brusselsMidnight(nextBrusselsDay(day)) }
  dayRanges.set(day, range)
  return range
}

export function entryOverlapMs(entry: StaffEntryInterval, day: string, now = Date.now()): number {
  const range = brusselsDayRange(day)
  const start = Math.max(Date.parse(entry.started_at), range.start)
  const end = Math.min(entry.ended_at ? Date.parse(entry.ended_at) : now, range.end)
  return Math.max(0, end - start)
}

export function entrySegment(entry: StaffEntryInterval, day: string, now = Date.now()) {
  const range = brusselsDayRange(day)
  const rawStart = Date.parse(entry.started_at)
  const rawEnd = entry.ended_at ? Date.parse(entry.ended_at) : now
  const start = Math.max(rawStart, range.start)
  const end = Math.min(rawEnd, range.end)
  if (end <= start) return null
  const duration = range.end - range.start
  return {
    left: ((start - range.start) / duration) * 100,
    width: ((end - start) / duration) * 100,
  }
}
