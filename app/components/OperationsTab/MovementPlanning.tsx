'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { Horse, MovementPlan } from './OperationsTab'

type Props = {
  horses: Horse[]
  date: string
  movementPlans: MovementPlan[]
  onRefresh: () => void | Promise<void>
}

const movementTypes = [
  { key: 'walker', label: 'Walker', defaultStart: '08:10', defaultEnd: '08:40' },
  { key: 'field', label: 'Field', defaultStart: '09:00', defaultEnd: '12:00' },
  { key: 'sand_paddock', label: 'Paddock', defaultStart: '12:00', defaultEnd: '16:30' },
  { key: 'inside', label: 'Inside', defaultStart: '16:30', defaultEnd: '17:00' },
]

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString()
}

function formatTime(value: string | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPlanLabel(plan?: MovementPlan) {
  if (!plan) return 'Not planned'
  return `${formatTime(plan.starts_at)} - ${formatTime(plan.ends_at)}`
}

export default function MovementPlanning({ horses, date, movementPlans, onRefresh }: Props) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [editing, setEditing] = useState<{
    horse: Horse
    movementType: string
    plan?: MovementPlan
  } | null>(null)

  const filteredHorses = useMemo(() => {
    const q = search.trim().toLowerCase()
    return horses.filter((horse) => !q || (horse.name || '').toLowerCase().includes(q))
  }, [horses, search])

  const stats = useMemo(() => {
    return movementTypes.map((type) => ({
      ...type,
      count: movementPlans.filter((plan) => plan.movement_type === type.key).length,
    }))
  }, [movementPlans])

  function findPlan(horseId: string, type: string) {
    return movementPlans.find((plan) => plan.horse_id === horseId && plan.movement_type === type)
  }

  async function saveMovement(
    horse: Horse,
    type: string,
    start: string,
    end: string,
    notes?: string,
  ) {
    const { error } = await supabase.from('horse_movement_planning').upsert(
      {
        horse_id: horse.id,
        date,
        movement_type: type,
        starts_at: toIso(date, start),
        ends_at: toIso(date, end),
        assigned_to: null,
        notes: notes || horse.name || null,
      },
      { onConflict: 'horse_id,date,movement_type' },
    )

    if (error) {
      alert(error.message)
      return
    }

    setEditing(null)
    await onRefresh()
  }

  async function deleteMovement(planId: string) {
    const { error } = await supabase.from('horse_movement_planning').delete().eq('id', planId)

    if (error) {
      alert(error.message)
      return
    }

    setEditing(null)
    await onRefresh()
  }

  async function quickApply(type: string) {
    const movement = movementTypes.find((item) => item.key === type)
    if (!movement) return

    const rows = filteredHorses.map((horse) => ({
      horse_id: horse.id,
      date,
      movement_type: type,
      starts_at: toIso(date, movement.defaultStart),
      ends_at: toIso(date, movement.defaultEnd),
      assigned_to: null,
      notes: horse.name || null,
    }))

    const { error } = await supabase.from('horse_movement_planning').upsert(rows, {
      onConflict: 'horse_id,date,movement_type',
    })

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  return (
    <section className="movement-page movement-premium">
      <div className="movement-hero">
        <div>
          <span className="ops-kicker">Movement planning</span>
          <h3>Daily horse flow</h3>
          <p>
            Plan the horse flow for {date}. Staff is assigned automatically when generating the full planning.
          </p>
        </div>

        <div className="movement-search">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search horse..."
          />

          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="all">All movements</option>
            {movementTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="movement-stats">
        {stats.map((type) => (
          <article key={type.key}>
            <span>{type.label}</span>
            <strong>{type.count}</strong>
            <button type="button" onClick={() => quickApply(type.key)}>
              Apply to visible
            </button>
          </article>
        ))}
      </div>

      <div className="movement-board">
        {filteredHorses.map((horse) => (
          <article key={horse.id} className="movement-horse-card">
            <div className="movement-horse-head">
              <div>
                <strong>{horse.name || 'Unnamed horse'}</strong>
                <span>
                  {horse.stable_location || 'No location'}
                  {horse.box_number ? ` · Box ${horse.box_number}` : ''}
                </span>
              </div>
            </div>

            <div className="movement-flow">
              {movementTypes
                .filter((type) => selectedType === 'all' || selectedType === type.key)
                .map((type) => {
                  const plan = findPlan(horse.id, type.key)

                  return (
                    <button
                      key={type.key}
                      type="button"
                      className={`movement-step ${plan ? 'planned' : ''} type-${type.key}`}
                      onClick={() => setEditing({ horse, movementType: type.key, plan })}
                    >
                      <small>{type.label}</small>
                      <strong>{getPlanLabel(plan)}</strong>
                      <span>{plan ? 'Staff chosen by system' : 'Click to plan'}</span>
                    </button>
                  )
                })}
            </div>
          </article>
        ))}
      </div>

      {editing && (
        <MovementModal
          horse={editing.horse}
          movementType={editing.movementType}
          plan={editing.plan}
          onClose={() => setEditing(null)}
          onSave={saveMovement}
          onDelete={deleteMovement}
        />
      )}
    </section>
  )
}

function MovementModal({
  horse,
  movementType,
  plan,
  onClose,
  onSave,
  onDelete,
}: {
  horse: Horse
  movementType: string
  plan?: MovementPlan
  onClose: () => void
  onSave: (horse: Horse, type: string, start: string, end: string, notes?: string) => void
  onDelete: (planId: string) => void
}) {
  const defaults = movementTypes.find((type) => type.key === movementType)

  const [start, setStart] = useState(formatTime(plan?.starts_at) || defaults?.defaultStart || '08:00')
  const [end, setEnd] = useState(formatTime(plan?.ends_at) || defaults?.defaultEnd || '08:30')
  const [notes, setNotes] = useState(plan?.notes || '')

  return (
    <div className="ops-modal-backdrop" onClick={onClose}>
      <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ops-modal-top">
          <div>
            <span className="ops-kicker">Movement</span>
            <h2>{horse.name}</h2>
          </div>

          <button type="button" className="ops-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="movement-modal-type">{movementType.replace('_', ' ')}</div>

        <div className="movement-auto-note">
          Staff is not selected here. The planner assigns this task to the best available person.
        </div>

        <div className="ops-form-row">
          <div className="ops-form-group">
            <label>Start</label>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>

          <div className="ops-form-group">
            <label>End</label>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        <div className="ops-form-group">
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="ops-modal-actions">
          {plan ? (
            <button type="button" className="ops-delete-btn" onClick={() => onDelete(plan.id)}>
              Delete
            </button>
          ) : (
            <span />
          )}

          <button type="button" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="ops-save-btn"
            onClick={() => onSave(horse, movementType, start, end, notes)}
          >
            Save movement
          </button>
        </div>
      </div>
    </div>
  )
}