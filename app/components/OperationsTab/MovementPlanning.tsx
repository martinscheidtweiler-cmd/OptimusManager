'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { Horse, MovementPlan, Staff } from './OperationsTab'

type Props = {
  horses: Horse[]
  staff: Staff[]
  date: string
  movementPlans: MovementPlan[]
  onRefresh: () => void
}

const movementTypes = [
  { key: 'walker', label: 'Walker' },
  { key: 'field', label: 'Field' },
  { key: 'sand_paddock', label: 'Sand paddock' },
  { key: 'inside', label: 'Inside' },
]

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function getDefaultTimes(type: string) {
  if (type === 'walker') return { start: '08:10', end: '08:40', person: 'Lenne' }
  if (type === 'field') return { start: '09:00', end: '12:00', person: 'Lenne' }
  if (type === 'sand_paddock') return { start: '12:00', end: '16:30', person: 'George' }
  return { start: '16:30', end: '17:00', person: 'George' }
}

export default function MovementPlanning({ horses, staff, date, movementPlans, onRefresh }: Props) {
  const [search, setSearch] = useState('')

  const filteredHorses = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return horses
    return horses.filter((horse) => (horse.name || '').toLowerCase().includes(q))
  }, [horses, search])

  function findPlan(horseId: string, type: string) {
    return movementPlans.find((plan) => plan.horse_id === horseId && plan.movement_type === type)
  }

  async function saveMovement(horse: Horse, type: string, start: string, end: string, assignedTo: string) {
    const { error } = await supabase.from('horse_movement_planning').upsert(
      {
        horse_id: horse.id,
        date,
        movement_type: type,
        starts_at: toIso(date, start),
        ends_at: toIso(date, end),
        assigned_to: assignedTo,
        notes: horse.name || null,
      },
      { onConflict: 'horse_id,date,movement_type' },
    )

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  async function deleteMovement(planId: string) {
    const { error } = await supabase.from('horse_movement_planning').delete().eq('id', planId)

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  return (
    <section className="movement-page">
      <div className="movement-top">
        <div>
          <span className="ops-kicker">Movement planning</span>
          <h3>Walker, field, sand paddock & inside</h3>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search horse..."
        />
      </div>

      <div className="movement-table-wrap">
        <div className="movement-table">
          <div className="movement-head horse">Horse</div>
          {movementTypes.map((type) => (
            <div key={type.key} className="movement-head">
              {type.label}
            </div>
          ))}

          {filteredHorses.map((horse) => (
            <div className="movement-row" key={horse.id}>
              <div className="movement-horse">
                <strong>{horse.name}</strong>
                <span>
                  {horse.stable_location}
                  {horse.box_number ? ` · Box ${horse.box_number}` : ''}
                </span>
              </div>

              {movementTypes.map((type) => {
                const plan = findPlan(horse.id, type.key)
                const defaults = getDefaultTimes(type.key)

                return (
                  <MovementCell
                    key={type.key}
                    plan={plan}
                    defaultStart={defaults.start}
                    defaultEnd={defaults.end}
                    defaultPerson={defaults.person}
                    staff={staff}
                    onSave={(start, end, assignedTo) =>
                      saveMovement(horse, type.key, start, end, assignedTo)
                    }
                    onDelete={() => {
                      if (plan) deleteMovement(plan.id)
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MovementCell({
  plan,
  defaultStart,
  defaultEnd,
  defaultPerson,
  staff,
  onSave,
  onDelete,
}: {
  plan: MovementPlan | undefined
  defaultStart: string
  defaultEnd: string
  defaultPerson: string
  staff: Staff[]
  onSave: (start: string, end: string, assignedTo: string) => void
  onDelete: () => void
}) {
  const [start, setStart] = useState(formatTime(plan?.starts_at) || defaultStart)
  const [end, setEnd] = useState(formatTime(plan?.ends_at) || defaultEnd)
  const [assignedTo, setAssignedTo] = useState(plan?.assigned_to || defaultPerson)

  return (
    <div className={`movement-cell ${plan ? 'planned' : ''}`}>
      <div className="movement-time-row">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>

      <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
        {staff
          .filter((person) => person.active !== false)
          .map((person) => (
            <option key={person.id} value={person.name}>
              {person.name}
            </option>
          ))}
      </select>

      <div className="movement-actions">
        <button type="button" onClick={() => onSave(start, end, assignedTo)}>
          Save
        </button>

        {plan ? (
          <button type="button" className="delete" onClick={onDelete}>
            ×
          </button>
        ) : null}
      </div>
    </div>
  )
}