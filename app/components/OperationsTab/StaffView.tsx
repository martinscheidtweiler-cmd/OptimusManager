'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { Staff, StaffDayStatus } from './OperationsTab'

type Props = {
  staff: Staff[]
  selectedDate: string
  staffStatuses: Record<string, StaffDayStatus>
  onRefresh: () => void | Promise<void>
}

const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'sick', label: 'Sick' },
  { value: 'half_day', label: 'Half day' },
]

const taskTypes = [
  'feed',
  'walker',
  'turnout',
  'paddock',
  'ride',
  'groom',
  'medical',
  'muck',
  'manual',
]

export default function StaffView({ staff, selectedDate, staffStatuses, onRefresh }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null)

  async function saveDayStatus(person: Staff, patch: Partial<StaffDayStatus>) {
    setSavingId(person.id)

    const current = staffStatuses[person.id]

    const payload = {
      staff_id: person.id,
      date: selectedDate,
      status: patch.status || current?.status || 'available',
      available_from:
        patch.available_from !== undefined
          ? patch.available_from
          : current?.available_from || person.start_time,
      available_until:
        patch.available_until !== undefined
          ? patch.available_until
          : current?.available_until || person.end_time,
      note: patch.note !== undefined ? patch.note : current?.note || null,
    }

    const { error } = await supabase.from('staff_day_status').upsert(payload, {
      onConflict: 'staff_id,date',
    })

    if (error) {
      alert(error.message)
      setSavingId(null)
      return
    }

    setSavingId(null)
    await onRefresh()
  }

  async function toggleAllowedTask(person: Staff, taskType: string) {
    setSavingId(person.id)

    const current = person.allowed_task_types || []
    const next = current.includes(taskType)
      ? current.filter((item) => item !== taskType)
      : [...current, taskType]

    const { error } = await supabase
      .from('staff')
      .update({ allowed_task_types: next })
      .eq('id', person.id)

    if (error) {
      alert(error.message)
      setSavingId(null)
      return
    }

    setSavingId(null)
    await onRefresh()
  }

  return (
    <section className="staff-planner">
      <div className="ops-section-head">
        <div>
          <span className="ops-kicker">Staff</span>
          <h3>Availability & allowed tasks</h3>
        </div>
      </div>

      <div className="staff-grid">
        {staff.map((person) => {
          const day = staffStatuses[person.id]
          const status = day?.status || 'available'
          const allowed = person.allowed_task_types || []

          return (
            <article key={person.id} className={`staff-card status-${status}`}>
              <div className="staff-card-top">
                <div>
                  <strong>{person.name}</strong>
                  <span>{person.role || 'Staff'}</span>
                </div>

                <select
                  value={status}
                  onChange={(e) =>
                    saveDayStatus(person, {
                      status: e.target.value as StaffDayStatus['status'],
                    })
                  }
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="staff-time-row">
                <label>
                  From
                  <input
                    type="time"
                    defaultValue={(day?.available_from || person.start_time || '07:00').slice(0, 5)}
                    onBlur={(e) => saveDayStatus(person, { available_from: e.target.value })}
                    disabled={['absent', 'holiday', 'sick'].includes(status)}
                  />
                </label>

                <label>
                  Until
                  <input
                    type="time"
                    defaultValue={(day?.available_until || person.end_time || '17:00').slice(0, 5)}
                    onBlur={(e) => saveDayStatus(person, { available_until: e.target.value })}
                    disabled={['absent', 'holiday', 'sick'].includes(status)}
                  />
                </label>
              </div>

              <textarea
                defaultValue={day?.note || ''}
                placeholder="Note..."
                onBlur={(e) => saveDayStatus(person, { note: e.target.value || null })}
              />

              <div className="staff-skills">
                <span>Allowed tasks</span>

                <div className="staff-skill-grid">
                  {taskTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={allowed.includes(type) ? 'active' : ''}
                      onClick={() => toggleAllowedTask(person, type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="staff-card-foot">
                <span>
                  Default: {person.start_time?.slice(0, 5) || '--:--'} -{' '}
                  {person.end_time?.slice(0, 5) || '--:--'}
                </span>

                {savingId === person.id ? <em>Saving...</em> : null}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}