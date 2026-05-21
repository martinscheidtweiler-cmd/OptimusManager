'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { StableTask, Staff, StaffDayStatus } from './OperationsTab'

type Props = {
  selectedDate: string
  allStaff: Staff[]
  staffStatuses: Record<string, StaffDayStatus>
  tasksByPerson: Record<string, StableTask[]>
  onRefresh: () => void | Promise<void>
}

const START_HOUR = 7
const END_HOUR = 24

const HOUR_HEIGHT = 420
const TIME_WIDTH = 86
const STAFF_WIDTH = 360
const TASK_GAP = 8

function minutesFromStart(value: string | null) {
  if (!value) return 0
  const d = new Date(value)
  return Math.max(0, (d.getHours() - START_HOUR) * 60 + d.getMinutes())
}

function durationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 30
  return Math.max(5, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
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

function getStaffStatusClass(status?: StaffDayStatus) {
  if (!status) return 'available'
  return status.status || 'available'
}

export default function TimelineBoard({
  selectedDate,
  allStaff,
  staffStatuses,
  tasksByPerson,
  onRefresh,
}: Props) {
  const [selectedPerson, setSelectedPerson] = useState('all')
  const [selectedTask, setSelectedTask] = useState<StableTask | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTaskType, setNewTaskType] = useState('manual')
  const [newAssignedTo, setNewAssignedTo] = useState('')
  const [newStart, setNewStart] = useState('08:00')
  const [newEnd, setNewEnd] = useState('08:30')
  const [newPriority, setNewPriority] = useState('50')
  const [newNotes, setNewNotes] = useState('')

  const [editTitle, setEditTitle] = useState('')
  const [editAssignedTo, setEditAssignedTo] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editPriority, setEditPriority] = useState('50')
  const [editNotes, setEditNotes] = useState('')

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

  function openTask(task: StableTask) {
    setSelectedTask(task)
    setEditTitle(task.title || '')
    setEditAssignedTo(task.assigned_to || '')
    setEditStart(formatTime(task.starts_at))
    setEditEnd(formatTime(task.ends_at))
    setEditPriority(String(task.priority || 50))
    setEditNotes(task.notes || '')
  }

  async function createTask() {
    if (!newTitle.trim()) {
      alert('Title is required')
      return
    }

    const startIso = newStart ? new Date(`${selectedDate}T${newStart}:00`).toISOString() : null
    const endIso = newEnd ? new Date(`${selectedDate}T${newEnd}:00`).toISOString() : null

    const { error } = await supabase.from('stable_tasks').insert({
      date: selectedDate,
      title: newTitle.trim(),
      task_type: newTaskType,
      assigned_to: newAssignedTo || null,
      starts_at: startIso,
      ends_at: endIso,
      priority: Number(newPriority || 50),
      notes: newNotes || null,
      auto_generated: false,
      status: 'pending',
    })

    if (error) {
      alert(error.message)
      return
    }

    setShowCreate(false)
    setNewTitle('')
    setNewTaskType('manual')
    setNewAssignedTo('')
    setNewStart('08:00')
    setNewEnd('08:30')
    setNewPriority('50')
    setNewNotes('')

    await onRefresh()
  }

  async function deleteTask() {
    if (!selectedTask) return

    const { error } = await supabase.from('stable_tasks').delete().eq('id', selectedTask.id)

    if (error) {
      alert(error.message)
      return
    }

    setSelectedTask(null)
    await onRefresh()
  }

  async function saveTask() {
    if (!selectedTask) return

    const startIso = editStart ? new Date(`${selectedDate}T${editStart}:00`).toISOString() : null
    const endIso = editEnd ? new Date(`${selectedDate}T${editEnd}:00`).toISOString() : null

    const { error } = await supabase
      .from('stable_tasks')
      .update({
        title: editTitle,
        assigned_to: editAssignedTo || null,
        starts_at: startIso,
        ends_at: endIso,
        priority: Number(editPriority || 50),
        notes: editNotes || null,
      })
      .eq('id', selectedTask.id)

    if (error) {
      alert(error.message)
      return
    }

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

    if (error) {
      alert(error.message)
      return
    }

    setSelectedTask(null)
    await onRefresh()
  }

  return (
    <>
      <section className="vtime-shell">
        <div className="vtime-toolbar">
          <div>
            <span className="vtime-eyebrow">Operations timeline</span>
            <h3>{selectedDate}</h3>
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

            <button type="button" className="ops-add-task-btn" onClick={() => setShowCreate(true)}>
              + Add task
            </button>
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

              {visiblePeople.map((person) => {
                const staffPerson = allStaff.find((s) => s.name === person)
                const status = staffPerson ? staffStatuses[staffPerson.id] : undefined
                const statusClass = getStaffStatusClass(status)

                return (
                  <div key={person} className={`vtime-head-person staff-${statusClass}`}>
                    <span>{person}</span>

                    {status ? (
                      <small>
                        {status.status}
                        {status.available_from ? ` · ${status.available_from.slice(0, 5)}` : ''}
                      </small>
                    ) : (
                      <small>available</small>
                    )}
                  </div>
                )
              })}
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
                const staffPerson = allStaff.find((s) => s.name === person)
                const status = staffPerson ? staffStatuses[staffPerson.id] : undefined
                const statusClass = getStaffStatusClass(status)
                const tasks = layoutTasks(tasksByPerson[person] || [])

                return (
                  <div
                    key={person}
                    className={`vtime-column staff-${statusClass}`}
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

                    {(statusClass === 'absent' || statusClass === 'holiday' || statusClass === 'sick') && (
                      <div className="vtime-unavailable">
                        {statusClass.toUpperCase()}
                        {status?.note ? <span>{status.note}</span> : null}
                      </div>
                    )}

                    {tasks.map((task) => {
                      const top = (getStart(task) / 60) * HOUR_HEIGHT
                      const height = Math.max(
                        34,
                        (durationMinutes(task.starts_at, task.ends_at) / 60) * HOUR_HEIGHT,
                      )

                      const laneWidth = (STAFF_WIDTH - 26 - (task.lanes - 1) * TASK_GAP) / task.lanes
                      const left = 13 + task.lane * (laneWidth + TASK_GAP)

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
                          onClick={() => openTask(task)}
                        >
                          <strong>{task.title}</strong>
                          <span>
                            {formatTime(task.starts_at)} - {formatTime(task.ends_at)}
                          </span>
                          {task.priority ? <em>P{task.priority}</em> : null}
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

      {showCreate && (
        <div className="ops-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-top">
              <div>
                <span className="ops-kicker">New task</span>
                <h2>Add manual task</h2>
              </div>

              <button type="button" className="ops-close" onClick={() => setShowCreate(false)}>
                ×
              </button>
            </div>

            <div className="ops-form-group">
              <label>Title</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Type</label>
                <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)}>
                  <option value="feed">feed</option>
                  <option value="walker">walker</option>
                  <option value="turnout">turnout</option>
                  <option value="paddock">paddock</option>
                  <option value="ride">ride</option>
                  <option value="groom">groom</option>
                  <option value="medical">medical</option>
                  <option value="muck">muck</option>
                  <option value="manual">manual</option>
                </select>
              </div>

              <div className="ops-form-group">
                <label>Priority</label>
                <input type="number" value={newPriority} onChange={(e) => setNewPriority(e.target.value)} />
              </div>
            </div>

            <div className="ops-form-group">
              <label>Person</label>
              <select value={newAssignedTo} onChange={(e) => setNewAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {people.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Start</label>
                <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              </div>

              <div className="ops-form-group">
                <label>End</label>
                <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>

            <div className="ops-form-group">
              <label>Notes</label>
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            </div>

            <div className="ops-modal-actions">
              <button type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </button>

              <button type="button" className="ops-save-btn" onClick={createTask}>
                Save task
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="ops-modal-backdrop" onClick={() => setSelectedTask(null)}>
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-top">
              <div>
                <span className="ops-kicker">Edit task</span>
                <h2>{selectedTask.title}</h2>
              </div>

              <button type="button" className="ops-close" onClick={() => setSelectedTask(null)}>
                ×
              </button>
            </div>

            <div className="ops-form-group">
              <label>Title</label>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>

            <div className="ops-form-group">
              <label>Person</label>
              <select value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {people.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Start</label>
                <input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
              </div>

              <div className="ops-form-group">
                <label>End</label>
                <input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
              </div>
            </div>

            <div className="ops-form-group">
              <label>Priority</label>
              <input type="number" value={editPriority} onChange={(e) => setEditPriority(e.target.value)} />
            </div>

            <div className="ops-form-group">
              <label>Notes</label>
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>

            <div className="ops-modal-actions">
              <button type="button" className="ops-delete-btn" onClick={deleteTask}>
                Delete
              </button>

              <button type="button" onClick={() => setStatus('pending')}>
                Pending
              </button>

              <button type="button" onClick={() => setStatus('in_progress')}>
                Start
              </button>

              <button type="button" onClick={() => setStatus('done')}>
                Done
              </button>

              <button type="button" className="ops-save-btn" onClick={saveTask}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}