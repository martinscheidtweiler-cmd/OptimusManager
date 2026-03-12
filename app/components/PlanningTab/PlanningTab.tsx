'use client'

import { useMemo, useState } from 'react'
import './planning.css'

type ViewMode = 'day' | 'week'

type PlanningItem = {
  id: string
  rider: string
  horse: string
  type: string
  status: 'To do' | 'Busy' | 'Done'
  day: string
  start: string
  duration: number
  note?: string
}

const RIDERS = ['Lars', 'Emma', 'Sophie', 'Thomas', 'Julie', 'Noah', 'Mila']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const DAY_START_HOUR = 6
const DAY_END_HOUR = 19
const PX_PER_MIN = 1.35

const HORSES = [
  'Queen',
  'Qamar',
  'Rosanna',
  'Quando',
  'Diamant',
  'Obsession',
  'Cicero',
  'Mistral',
  'Orlando',
  'Pegase',
  'Nikita',
  'Rex',
  'Atlas',
  'Chablis',
  'Vigo',
  'Nora',
  'Elektra',
  'Tornado',
  'Uno',
  'Kashmir',
  'Valencia',
  'Ona',
  'Casper',
  'Mona',
  'Eros',
  'Sultan',
  'Juno',
  'Apollo',
  'Riviera',
  'Fuego',
  'Indra',
  'Mylord',
  'Berlin',
  'Fanta',
  'Lexus',
  'Toscane',
  'Hero',
  'Utopia',
  'Bingo',
  'Sierra',
  'Nemo',
  'Romy',
  'Falco',
  'Zidane',
  'Bonita',
  'Kyra',
  'Dollar',
  'Mango',
  'Otis',
]

const TRAINING_TYPES = [
  'Flatwork',
  'Jumping',
  'Lunging',
  'Hack',
  'Polework',
  'Flatwork',
  'Jumping',
  'Flatwork',
]

const DURATIONS = [40, 40, 40, 60, 40, 60]

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function toTimeString(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function buildDaySchedule(day: string, dayIndex: number): PlanningItem[] {
  const items: PlanningItem[] = []
  let horseOffset = dayIndex * 9

  RIDERS.forEach((rider, riderIndex) => {
    let currentMinutes = DAY_START_HOUR * 60

    DURATIONS.forEach((duration, slotIndex) => {
      const horse =
        HORSES[(horseOffset + riderIndex * 6 + slotIndex) % HORSES.length]

      const type =
        TRAINING_TYPES[(dayIndex + riderIndex + slotIndex) % TRAINING_TYPES.length]

      let status: PlanningItem['status'] = 'To do'

      if (day === 'Wed') {
        if (slotIndex < 2) status = 'Done'
        else if (slotIndex === 2) status = 'Busy'
      } else if (day === 'Thu') {
        if (slotIndex === 0) status = 'Busy'
      }

      items.push({
        id: `${day}-${rider}-${slotIndex}`,
        rider,
        horse,
        type,
        status,
        day,
        start: toTimeString(currentMinutes),
        duration,
        note:
          slotIndex % 3 === 0
            ? 'Focus on rhythm and straightness.'
            : slotIndex % 3 === 1
            ? 'Keep the horse light in the hand.'
            : 'Quiet work, no pressure today.',
      })

      currentMinutes += duration
    })
  })

  return items
}

const planningData: PlanningItem[] = DAYS.flatMap((day, dayIndex) =>
  buildDaySchedule(day, dayIndex)
)

export default function PlanningTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedDay, setSelectedDay] = useState('Wed')
  const [selectedItem, setSelectedItem] = useState<PlanningItem | null>(null)

  const dayData = useMemo(
    () => planningData.filter((item) => item.day === selectedDay),
    [selectedDay]
  )

  const totalMinutes = (DAY_END_HOUR - DAY_START_HOUR) * 60
  const timelineHeight = totalMinutes * PX_PER_MIN

  const hourLabels = useMemo(() => {
    const labels: string[] = []
    for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour++) {
      labels.push(`${String(hour).padStart(2, '0')}:00`)
    }
    return labels
  }, [])

  return (
    <div className="timeline-board">
      <div className="tb-top">
        <div>
          <span className="tb-kicker">Stable Board</span>
          <h2>Rider Planning</h2>
          <p>7 riders · real timeline from 06:00 until 19:00</p>
        </div>

        <div className="tb-controls">
          <div className="tb-switch">
            <button
              className={viewMode === 'day' ? 'active' : ''}
              onClick={() => setViewMode('day')}
            >
              Day
            </button>
            <button
              className={viewMode === 'week' ? 'active' : ''}
              onClick={() => setViewMode('week')}
            >
              Week
            </button>
          </div>

          <div className="tb-days">
            {DAYS.map((day) => (
              <button
                key={day}
                className={selectedDay === day ? 'active' : ''}
                onClick={() => {
                  setSelectedDay(day)
                  setViewMode('day')
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>

      {viewMode === 'day' ? (
        <div className="tb-scroll">
          <div className="tb-grid-wrap">
            <div className="tb-header-row">
              <div className="tb-time-header">Time</div>
              {RIDERS.map((rider) => (
                <div key={rider} className="tb-rider-header">
                  {rider}
                </div>
              ))}
            </div>

            <div className="tb-body-row">
              <div className="tb-time-column" style={{ height: `${timelineHeight}px` }}>
                {hourLabels.map((label, index) => {
                  const top = index * 60 * PX_PER_MIN
                  return (
                    <div
                      key={label}
                      className="tb-time-label"
                      style={{ top: `${top}px` }}
                    >
                      {label}
                    </div>
                  )
                })}
              </div>

              {RIDERS.map((rider) => {
                const riderItems = dayData.filter((item) => item.rider === rider)

                return (
                  <div
                    key={rider}
                    className="tb-rider-column"
                    style={{ height: `${timelineHeight}px` }}
                  >
                    {hourLabels.map((label, index) => {
                      const top = index * 60 * PX_PER_MIN
                      return (
                        <div
                          key={label}
                          className="tb-hour-line"
                          style={{ top: `${top}px` }}
                        />
                      )
                    })}

                    {riderItems.map((item) => {
                      const top =
                        (toMinutes(item.start) - DAY_START_HOUR * 60) * PX_PER_MIN
                      const height = item.duration * PX_PER_MIN

                      return (
                        <button
                          key={item.id}
                          className={`tb-event ${statusClass(item.status)}`}
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                          }}
                          onClick={() => setSelectedItem(item)}
                        >
                          <strong>{item.horse}</strong>
                          <span>{item.type}</span>
                          <small>
                            {item.start} · {item.duration} min
                          </small>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="tb-week-list">
          {DAYS.map((day) => {
            const items = planningData.filter((item) => item.day === day)
            return (
              <button
                key={day}
                className={`tb-week-day ${selectedDay === day ? 'active' : ''}`}
                onClick={() => {
                  setSelectedDay(day)
                  setViewMode('day')
                }}
              >
                <div>
                  <strong>{day}</strong>
                  <span>{items.length} rides</span>
                </div>
                <small>Open day view</small>
              </button>
            )
          })}
        </div>
      )}

      {selectedItem && (
        <div className="tb-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="tb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tb-modal-top">
              <div>
                <span className="tb-kicker">Ride detail</span>
                <h3>{selectedItem.horse}</h3>
              </div>

              <button className="tb-close" onClick={() => setSelectedItem(null)}>
                ×
              </button>
            </div>

            <div className="tb-detail-grid">
              <Detail label="Rider" value={selectedItem.rider} />
              <Detail label="Day" value={selectedItem.day} />
              <Detail label="Start" value={selectedItem.start} />
              <Detail label="Duration" value={`${selectedItem.duration} min`} />
              <Detail label="Type" value={selectedItem.type} />
              <Detail label="Status" value={selectedItem.status} />
            </div>

            {selectedItem.note && (
              <div className="tb-note">
                <span>Note</span>
                <p>{selectedItem.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="tb-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function statusClass(status: PlanningItem['status']) {
  if (status === 'Done') return 'done'
  if (status === 'Busy') return 'busy'
  return 'todo'
}