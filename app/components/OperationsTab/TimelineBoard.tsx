'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { StableTask, Staff } from './OperationsTab'

type Props = {
  allStaff: Staff[]
  tasksByPerson: Record<string, StableTask[]>
  onRefresh: () => void
}

const START_HOUR = 7
const END_HOUR = 24

const HOUR_HEIGHT = 140
const TIME_WIDTH = 92
const STAFF_WIDTH = 390
const TASK_GAP = 8

function minutesFromStart(value: string | null) {
  if (!value) return 0
  const d = new Date(value)
  return Math.max(0, (d.getHours() - START_HOUR) * 60 + d.getMinutes())
}

function durationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 30
  return Math.max(10, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

function formatTime(value: string | null) {
  if (!value) return '--:--'
  return new Date(value).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function taskClass(type: string | null) {
  const t = (type || '').toLowerCase()

  if (t.includes('feed')) return 'feed'
  if (t.includes('walker')) return 'walker'
  if (t.includes('turnout')) return 'turnout'
  if (t.includes('paddock')) return 'paddock'
  if (t.includes('ride')) return 'ride'
  if (t.includes('groom') || t.includes('tack') || t.includes('aftercare')) return 'groom'
  if (t.includes('medical') || t.includes('vet') || t.includes('medication')) return 'medical'
  if (t.includes('muck')) return 'muck'

  return 'manual'
}

function getStart(task: StableTask) {
  return minutesFromStart(task.starts_at)
}

function getEnd(task: StableTask) {
  return getStart(task) + durationMinutes(task.starts_at, task.ends_at)
}

function overlaps(a: StableTask, b: StableTask) {
  return getStart(a) < getEnd(b) && getEnd(a) > getStart(b)
}

function hasConflict(task: StableTask, list: StableTask[]) {
  return list.some((other) => other.id !== task.id && overlaps(task, other))
}

function layoutTasks(tasks: StableTask[]) {
  const sorted = [...tasks].sort((a, b) => getStart(a) - getStart(b))

  const placed: Array<StableTask & { lane: number; lanes: number; conflict: boolean }> = []
  const laneEnds: number[] = []

  for (const task of sorted) {
    const start = getStart(task)

    let lane = laneEnds.findIndex((end) => end <= start)

    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(getEnd(task))
    } else {
      laneEnds[lane] = getEnd(task)
    }

    placed.push({
      ...task,
      lane,
      lanes: 1,
      conflict: hasConflict(task, sorted),
    })
  }

  for (const task of placed) {
    const group = placed.filter((other) => overlaps(task, other) || other.id === task.id)
    task.lanes = Math.max(1, ...group.map((g) => g.lane + 1))
  }

  return placed
}

export default function TimelineBoard({ allStaff, tasksByPerson, onRefresh }: Props) {
  const [selectedPerson, setSelectedPerson] = useState('all')
  const [selectedTask, setSelectedTask] = useState<StableTask | null>(null)

  const people = useMemo(() => {
    const names = new Set<string>()

    allStaff.forEach((person) => {
      if (person.active !== false) names.add(person.name)
    })

    Object.keys(tasksByPerson).forEach((name) => names.add(name))

    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [allStaff, tasksByPerson])

  const visiblePeople = selectedPerson === 'all' ? people : [selectedPerson]

  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)
  const boardHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  const conflictCount = useMemo(() => {
    return visiblePeople.reduce((total, person) => {
      const tasks = tasksByPerson[person] || []
      return total + tasks.filter((task) => hasConflict(task, tasks)).length
    }, 0)
  }, [visiblePeople, tasksByPerson])

  async function deleteTask() {
    if (!selectedTask) return

    const { error } = await supabase.from('stable_tasks').delete().eq('id', selectedTask.id)
    if (error) return alert(error.message)

    setSelectedTask(null)
    await onRefresh()
  }

  async function setStatus(status: 'pending' | 'in_progress' | 'done') {
    if (!selectedTask) return

    const { error } = await supabase
      .from('stable_tasks')
      .update({
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
        completed_by: status === 'done' ? selectedTask.assigned_to : null,
      })
      .eq('id', selectedTask.id)

    if (error) return alert(error.message)

    setSelectedTask(null)
    await onRefresh()
  }

  return (
    <>
      <section className="vtime-shell">
        <div className="vtime-toolbar">
          <div>
            <span className="vtime-eyebrow">Daily operations</span>
            <h3>Task timeline</h3>
          </div>

          <div className="vtime-toolbar-right">
            <div className="ops-person-filter">
              <label>Person</label>
              <select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)}>
                <option value="all">All staff</option>
                {people.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className={`vtime-conflict-counter ${conflictCount > 0 ? 'has-conflicts' : ''}`}>
              {conflictCount > 0 ? `${conflictCount} overlaps` : 'Clean planning'}
            </div>
          </div>
        </div>

        <div className="vtime-wrap">
          <div
            className="vtime-board"
            style={{
              width: TIME_WIDTH + visiblePeople.length * STAFF_WIDTH,
            }}
          >
            <div className="vtime-head">
              <div className="vtime-head-time">TIME</div>

              {visiblePeople.map((person) => (
                <div key={person} className="vtime-head-person">
                  <span>{person}</span>
                </div>
              ))}
            </div>

            <div className="vtime-body" style={{ height: boardHeight }}>
              <div className="vtime-hours" style={{ width: TIME_WIDTH }}>
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="vtime-hour-label"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {visiblePeople.map((person, index) => {
                const tasks = layoutTasks(tasksByPerson[person] || [])

                return (
                  <div
                    key={person}
                    className="vtime-column"
                    style={{
                      left: TIME_WIDTH + index * STAFF_WIDTH,
                      width: STAFF_WIDTH,
                      height: boardHeight,
                    }}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="vtime-hour-line"
                        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}

                    {tasks.map((task) => {
                      const top = (getStart(task) / 60) * HOUR_HEIGHT
                      const height = Math.max(
                        42,
                        (durationMinutes(task.starts_at, task.ends_at) / 60) * HOUR_HEIGHT,
                      )

                      const laneWidth = (STAFF_WIDTH - 28 - (task.lanes - 1) * TASK_GAP) / task.lanes
                      const left = 14 + task.lane * (laneWidth + TASK_GAP)

                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`vtime-task ${taskClass(task.task_type)} status-${
                            task.status || 'pending'
                          } ${task.conflict ? 'conflict' : ''}`}
                          style={{
                            top,
                            height,
                            left,
                            width: laneWidth,
                          }}
                          onClick={() => setSelectedTask(task)}
                        >
                          <strong>
                            {formatTime(task.starts_at)} - {formatTime(task.ends_at)}{' '}
                            {task.title.toLowerCase()}
                          </strong>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedTask && (
        <div className="ops-modal-backdrop" onClick={() => setSelectedTask(null)}>
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-top">
              <div>
                <span className="ops-kicker">Task</span>
                <h2>{selectedTask.title}</h2>
              </div>

              <button type="button" className="ops-close" onClick={() => setSelectedTask(null)}>
                ×
              </button>
            </div>

            <div className="ops-form-group">
              <label>Person</label>
              <input value={selectedTask.assigned_to || ''} readOnly />
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Start</label>
                <input value={formatTime(selectedTask.starts_at)} readOnly />
              </div>

              <div className="ops-form-group">
                <label>End</label>
                <input value={formatTime(selectedTask.ends_at)} readOnly />
              </div>
            </div>

            <div className="ops-form-group">
              <label>Notes</label>
              <textarea defaultValue={selectedTask.notes || ''} readOnly />
            </div>

            <div className="ops-modal-actions">
              <button type="button" className="ops-delete-btn" onClick={deleteTask}>
                Delete
              </button>

              <button type="button" onClick={() => setStatus('in_progress')}>
                Start
              </button>

              <button type="button" className="ops-save-btn" onClick={() => setStatus('done')}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}