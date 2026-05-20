'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { supabase } from '@/app/lib/supabaseClient'
import type { StableTask, Staff } from './OperationsTab'

type Props = {
  todayStaff: Staff[]
  allStaff: Staff[]
  tasksByPerson: Record<string, StableTask[]>
  onRefresh: () => void
}

type ActiveTask = StableTask | null

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatTime(value: string | null) {
  if (!value) return '--:--'

  return new Date(value).toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DraggableTask({
  task,
  laneName,
  onRefresh,
}: {
  task: StableTask
  laneName: string
  onRefresh: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: {
      task,
    },
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`ops-task-card status-${task.status || 'pending'} ${
        isDragging ? 'is-dragging' : ''
      }`}
    >
      <div className="ops-task-drag" {...attributes} {...listeners}>
        ⋮⋮
      </div>

      <div className="ops-task-body">
        <strong>{task.title}</strong>
        <span>
          {formatTime(task.starts_at)} - {formatTime(task.ends_at)}
        </span>
        {task.notes ? <em>{task.notes}</em> : null}

        <div className="ops-task-actions">
          <button
            type="button"
            onClick={() => updateTaskStatus(task.id, 'in_progress', laneName, onRefresh)}
          >
            Start
          </button>
          <button type="button" onClick={() => updateTaskStatus(task.id, 'done', laneName, onRefresh)}>
            Done
          </button>
          <button type="button" onClick={() => updateTaskStatus(task.id, 'pending', laneName, onRefresh)}>
            Reset
          </button>
          <button type="button" onClick={() => deleteTask(task.id, onRefresh)}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

function DroppableLane({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${name}`,
    data: { name },
  })

  return (
    <article ref={setNodeRef} className={`ops-staff-lane ${isOver ? 'is-over' : ''}`}>
      <strong>{name}</strong>
      {children}
    </article>
  )
}

async function updateTaskStatus(
  taskId: string,
  status: 'pending' | 'in_progress' | 'done',
  assignedTo: string,
  onRefresh: () => void,
) {
  const payload =
    status === 'done'
      ? {
          status,
          completed_at: new Date().toISOString(),
          completed_by: assignedTo,
        }
      : {
          status,
          completed_at: null,
          completed_by: null,
        }

  const { error } = await supabase.from('stable_tasks').update(payload).eq('id', taskId)

  if (error) {
    alert(error.message)
    return
  }

  await onRefresh()
}

async function deleteTask(taskId: string, onRefresh: () => void) {
  const { error } = await supabase.from('stable_tasks').delete().eq('id', taskId)

  if (error) {
    alert(error.message)
    return
  }

  await onRefresh()
}

export default function PlanningBoard({ todayStaff, allStaff, tasksByPerson, onRefresh }: Props) {
  const [selectedPerson, setSelectedPerson] = useState<string>('All')
  const [showModal, setShowModal] = useState(false)
  const [activeTask, setActiveTask] = useState<ActiveTask>(null)

  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [duration, setDuration] = useState('30')
  const [notes, setNotes] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const people = useMemo(() => {
    const names = new Set<string>()

    allStaff.forEach((person) => {
      if (person.active !== false) names.add(person.name)
    })

    Object.keys(tasksByPerson).forEach((name) => names.add(name))

    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [allStaff, tasksByPerson])

  const visiblePeople = selectedPerson === 'All' ? people : [selectedPerson]

  async function createManualTask() {
    if (!title || !assignedTo) {
      alert('Fill in title and assigned person')
      return
    }

    const date = todayIso()
    const start = new Date(`${date}T${startTime}:00`)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + Number(duration || 30))

    const { error } = await supabase.from('stable_tasks').insert({
      date,
      title,
      assigned_to: assignedTo,
      task_type: 'manual',
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      notes: notes || null,
      auto_generated: false,
      status: 'pending',
    })

    if (error) {
      alert(error.message)
      return
    }

    setShowModal(false)
    setTitle('')
    setAssignedTo('')
    setStartTime('08:00')
    setDuration('30')
    setNotes('')

    await onRefresh()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const over = event.over
    const task = event.active.data.current?.task as StableTask | undefined

    setActiveTask(null)

    if (!over || !task) return

    const laneName = String(over.id).replace('lane-', '')

    const { error } = await supabase
      .from('stable_tasks')
      .update({ assigned_to: laneName })
      .eq('id', task.id)

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as StableTask | undefined
    setActiveTask(task || null)
  }

  return (
    <>
      <div className="ops-board-toolbar">
        <div className="ops-person-filter">
          <label>View person</label>
          <select value={selectedPerson} onChange={(e) => setSelectedPerson(e.target.value)}>
            <option value="All">All staff</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <button type="button" className="ops-add-task-btn" onClick={() => setShowModal(true)}>
          + Add task
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="ops-board">
          {visiblePeople.map((name) => {
            const items = tasksByPerson[name] || []

            return (
              <DroppableLane key={name} name={name}>
                {items.length === 0 ? (
                  <div className="ops-empty-task">No tasks today</div>
                ) : (
                  <div className="ops-task-stack">
                    {items.map((task) => (
                      <DraggableTask key={task.id} task={task} laneName={name} onRefresh={onRefresh} />
                    ))}
                  </div>
                )}
              </DroppableLane>
            )
          })}
        </div>

        <DragOverlay>
          {activeTask ? <div className="ops-task-card drag-overlay">{activeTask.title}</div> : null}
        </DragOverlay>
      </DndContext>

      {showModal && (
        <div className="ops-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="ops-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add task</h3>

            <div className="ops-form-group">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
            </div>

            <div className="ops-form-group">
              <label>Assigned to</label>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Select person</option>
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
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>

              <div className="ops-form-group">
                <label>Duration minutes</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>

            <div className="ops-form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="ops-modal-actions">
              <button type="button" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="button" className="dark" onClick={createManualTask}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}