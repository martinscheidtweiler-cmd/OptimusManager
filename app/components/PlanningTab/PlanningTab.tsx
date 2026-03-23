'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/app/lib/supabaseClient'
import './planning.css'

type RideType = 'Flatwork' | 'Showjumping' | 'Lunging'

type HorseRow = {
  id: string
  name: string | null
  horse_type: string | null
}

type Horse = {
  id: string
  name: string
}

type Rider = {
  id: string
  name: string
  color: string
  isNoRider?: boolean
}

type Assignment = {
  id: string
  horseId: string
  date: string
  riderId: string
  type: RideType | null
  order: number
  minutes: number
}

type QuickAssignState = {
  horseId: string
  horseName: string
  date: string
} | null

type EditState = {
  assignmentId: string
} | null

type DragTemplateRideData = {
  kind: 'template-ride'
  riderId: string
  type: RideType
}

type DragTemplateNoRiderData = {
  kind: 'template-no-rider'
  riderId: string
}

type DragDayAssignmentData = {
  kind: 'day-assignment'
  assignmentId: string
}

type DropCellData = {
  kind: 'table-cell'
  horseId: string
  date: string
}

type ActiveDrag =
  | DragTemplateRideData
  | DragTemplateNoRiderData
  | DragDayAssignmentData
  | null

const RIDERS: Rider[] = [
  { id: 'r1', name: 'Terry', color: 'terry' },
  { id: 'r2', name: 'Cis', color: 'cis' },
  { id: 'r3', name: 'Lisa', color: 'lisa' },
  { id: 'r4', name: 'Lenne', color: 'lenne' },
  { id: 'r5', name: 'Alessia', color: 'alessia' },
  { id: 'r6', name: 'Rider1', color: 'rider1' },
  { id: 'r7', name: 'Rider2', color: 'rider2' },
  { id: 'nr', name: 'NO RIDER', color: 'norider', isNoRider: true },
]

const RIDE_TYPES: RideType[] = ['Flatwork', 'Showjumping', 'Lunging']
const STORAGE_KEY = 'hb-week-planner-v7'
const DEFAULT_RIDE_MINUTES = 40
const CHANGE_MINUTES = 10

function startOfMonday(base = new Date()) {
  const d = new Date(base)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(12, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toIsoDateLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIsoDateLocal(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function buildWeekDates(weekStart: Date) {
  return Array.from({ length: 7 }, (_, index) => toIsoDateLocal(addDays(weekStart, index)))
}

function formatDayLabel(date: string) {
  return parseIsoDateLocal(date).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })
}

function formatWeekRange(weekStart: Date) {
  const first = weekStart
  const last = addDays(weekStart, 6)

  const firstLabel = first.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })

  const lastLabel = last.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return `${firstLabel} — ${lastLabel}`
}

function cssTypeClass(type: RideType | null) {
  if (!type) return 'no-type'
  return type.toLowerCase()
}

function getRider(riderId: string) {
  return RIDERS.find((r) => r.id === riderId)
}

function sortAssignments(list: Assignment[]) {
  return [...list].sort((a, b) => a.order - b.order)
}

function normalizeOrders(list: Assignment[]) {
  return list.map((item, index) => ({
    ...item,
    order: index,
  }))
}

function formatTotalTime(items: Assignment[]) {
  if (items.length === 0) return '0 min'
  const rideMinutes = items.reduce((sum, item) => sum + item.minutes, 0)
  const changeMinutes = Math.max(0, items.length - 1) * CHANGE_MINUTES
  const total = rideMinutes + changeMinutes
  const hours = Math.floor(total / 60)
  const minutes = total % 60

  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours}u`
  return `${hours}u ${minutes}m`
}

function PlannerDropCell({
  horseId,
  date,
  isSelectedDay,
  children,
}: {
  horseId: string
  date: string
  isSelectedDay: boolean
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${horseId}-${date}`,
    data: {
      kind: 'table-cell',
      horseId,
      date,
    } satisfies DropCellData,
  })

  return (
    <div
      ref={setNodeRef}
      className={`planner-cell ${isSelectedDay ? 'selected' : ''} ${isOver ? 'drag-over' : ''}`}
    >
      {children}
    </div>
  )
}

function DraggableRideChip({
  rider,
  type,
}: {
  rider: Rider
  type: RideType
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-ride-${rider.id}-${type}`,
    data: {
      kind: 'template-ride',
      riderId: rider.id,
      type,
    } satisfies DragTemplateRideData,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`planner-chip rider-${rider.color} type-${cssTypeClass(type)} ${isDragging ? 'is-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      {type}
    </button>
  )
}

function DraggableNoRiderChip({ rider }: { rider: Rider }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `template-no-rider-${rider.id}`,
    data: {
      kind: 'template-no-rider',
      riderId: rider.id,
    } satisfies DragTemplateNoRiderData,
  })

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={`planner-chip planner-chip-black ${isDragging ? 'is-dragging' : ''}`}
      {...listeners}
      {...attributes}
    >
      NO RIDER
    </button>
  )
}

function SortableDayAssignment({
  assignment,
  horseName,
  rider,
  onOpen,
}: {
  assignment: Assignment
  horseName: string
  rider: Rider | undefined
  onOpen: (assignmentId: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: assignment.id,
    data: {
      kind: 'day-assignment',
      assignmentId: assignment.id,
    } satisfies DragDayAssignmentData,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`planner-day-item rider-${rider?.color ?? 'norider'} type-${cssTypeClass(assignment.type)} ${isDragging ? 'is-dragging' : ''}`}
    >
      <button
        type="button"
        className="planner-day-item-main"
        onClick={() => onOpen(assignment.id)}
      >
        <span className="planner-day-order">{assignment.order + 1}.</span>
        <div className="planner-day-item-text">
          <strong>{horseName}</strong>
          <span>
            {rider?.isNoRider ? 'NO RIDER' : assignment.type} · {assignment.minutes} min
          </span>
        </div>
      </button>

      <button
        type="button"
        className="planner-drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag"
      >
        ⋮⋮
      </button>
    </div>
  )
}

function TableAssignmentCard({
  assignment,
  rider,
  onOpen,
  onDelete,
}: {
  assignment: Assignment
  rider: Rider | undefined
  onOpen: (assignmentId: string) => void
  onDelete: (assignmentId: string) => void
}) {
  return (
    <div className={`planner-table-card rider-${rider?.color ?? 'norider'} type-${cssTypeClass(assignment.type)}`}>
      <button
        type="button"
        className="planner-table-delete"
        onClick={(e) => {
          e.stopPropagation()
          onDelete(assignment.id)
        }}
      >
        ×
      </button>

      <button
        type="button"
        className="planner-table-card-main"
        onClick={() => onOpen(assignment.id)}
      >
        {rider?.isNoRider ? (
          <>
            <div className="planner-table-card-only">NO RIDER</div>
            <div className="planner-table-card-minutes">{assignment.minutes} min</div>
          </>
        ) : (
          <>
            <div className="planner-table-card-type">{assignment.type}</div>
            <div className="planner-table-card-rider">{rider?.name}</div>
            <div className="planner-table-card-minutes">{assignment.minutes} min</div>
          </>
        )}
      </button>
    </div>
  )
}

export default function PlanningTab() {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => startOfMonday(new Date()))
  const [horses, setHorses] = useState<Horse[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [horseSearch, setHorseSearch] = useState('')
  const [activeDrag, setActiveDrag] = useState<ActiveDrag>(null)
  const [loadingHorses, setLoadingHorses] = useState(true)
  const [quickAssign, setQuickAssign] = useState<QuickAssignState>(null)
  const [editState, setEditState] = useState<EditState>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  const weekDates = useMemo(() => buildWeekDates(currentWeekStart), [currentWeekStart])

  useEffect(() => {
    setSelectedDate((prev) => (prev && weekDates.includes(prev) ? prev : weekDates[4] ?? weekDates[0] ?? ''))
  }, [weekDates])

  useEffect(() => {
    async function loadHorses() {
      setLoadingHorses(true)

      const { data, error } = await supabase
        .from('horses')
        .select('id, name, horse_type')
        .eq('horse_type', 'Sport horse')
        .order('name', { ascending: true })

      if (error) {
        console.error(error)
        setHorses([])
        setLoadingHorses(false)
        return
      }

      const mapped: Horse[] = ((data as HorseRow[] | null) ?? [])
        .filter((horse) => horse.name && horse.name.trim() !== '')
        .map((horse) => ({
          id: horse.id,
          name: horse.name!.trim(),
        }))

      setHorses(mapped)
      setLoadingHorses(false)
    }

    loadHorses()
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
      setAssignments(JSON.parse(raw) as Assignment[])
    } catch {
      setAssignments([])
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments))
  }, [assignments])

  const filteredHorses = useMemo(() => {
    const query = horseSearch.trim().toLowerCase()
    if (!query) return horses
    return horses.filter((horse) => horse.name.toLowerCase().includes(query))
  }, [horseSearch, horses])

  const assignmentsById = useMemo(() => {
    return new Map(assignments.map((item) => [item.id, item]))
  }, [assignments])

  const horseNameById = useMemo(() => {
    return new Map(horses.map((horse) => [horse.id, horse.name]))
  }, [horses])

  const selectedDayAssignments = useMemo(() => {
    return sortAssignments(assignments.filter((item) => item.date === selectedDate))
  }, [assignments, selectedDate])

  const selectedDayByRider = useMemo(() => {
    return RIDERS.map((rider) => ({
      rider,
      items: sortAssignments(
        selectedDayAssignments.filter((item) => item.riderId === rider.id)
      ),
    }))
  }, [selectedDayAssignments])

  const editAssignment = useMemo(() => {
    if (!editState) return null
    return assignmentsById.get(editState.assignmentId) ?? null
  }, [editState, assignmentsById])

  function getCellAssignment(horseId: string, date: string) {
    return assignments.find((item) => item.horseId === horseId && item.date === date)
  }

  function rebuildOrdersForDay(list: Assignment[], date: string) {
    const sameDay = list.filter((item) => item.date === date)
    const otherDays = list.filter((item) => item.date !== date)

    const rebuilt = RIDERS.flatMap((rider) =>
      normalizeOrders(
        sortAssignments(sameDay.filter((item) => item.riderId === rider.id))
      )
    )

    return [...otherDays, ...rebuilt]
  }

  function upsertAssignment(
    horseId: string,
    date: string,
    riderId: string,
    type: RideType | null
  ) {
    setAssignments((prev) => {
      const existing = prev.find((item) => item.horseId === horseId && item.date === date)
      const riderItems = sortAssignments(
        prev.filter(
          (item) =>
            item.date === date &&
            item.riderId === riderId &&
            item.id !== existing?.id
        )
      )

      const nextItem: Assignment = {
        id: existing?.id ?? `${horseId}-${date}`,
        horseId,
        date,
        riderId,
        type,
        order: riderItems.length,
        minutes: existing?.minutes ?? DEFAULT_RIDE_MINUTES,
      }

      const withoutCurrent = prev.filter(
        (item) => !(item.horseId === horseId && item.date === date)
      )

      const updated = [...withoutCurrent, nextItem]
      return rebuildOrdersForDay(updated, date)
    })
  }

  function removeAssignment(assignmentId: string) {
    setAssignments((prev) => {
      const existing = prev.find((item) => item.id === assignmentId)
      if (!existing) return prev
      const next = prev.filter((item) => item.id !== assignmentId)
      return rebuildOrdersForDay(next, existing.date)
    })
    setEditState(null)
  }

  function clearWeek() {
    setAssignments((prev) => prev.filter((item) => !weekDates.includes(item.date)))
  }

  function goNextWeek() {
    setCurrentWeekStart((prev) => addDays(prev, 7))
  }

  function goPreviousWeek() {
    setCurrentWeekStart((prev) => addDays(prev, -7))
  }

  function openQuickAssign(horseId: string, horseName: string, date: string) {
    setQuickAssign({ horseId, horseName, date })
    setSelectedDate(date)
  }

  function quickAssignRide(riderId: string, type: RideType | null) {
    if (!quickAssign) return
    upsertAssignment(quickAssign.horseId, quickAssign.date, riderId, type)
    setQuickAssign(null)
  }

  function updateAssignmentFromModal(values: {
    assignmentId: string
    riderId: string
    type: RideType | null
    minutes: number
  }) {
    setAssignments((prev) => {
      const existing = prev.find((item) => item.id === values.assignmentId)
      if (!existing) return prev

      const without = prev.filter((item) => item.id !== values.assignmentId)

      const targetList = sortAssignments(
        without.filter(
          (item) =>
            item.date === existing.date &&
            item.riderId === values.riderId
        )
      )

      const updated: Assignment = {
        ...existing,
        riderId: values.riderId,
        type: values.type,
        minutes: values.minutes,
        order: targetList.length,
      }

      return rebuildOrdersForDay([...without, updated], existing.date)
    })

    setEditState(null)
  }

  function moveDayAssignmentBetweenRiders(
    movingAssignmentId: string,
    targetRiderId: string,
    overAssignmentId?: string | null
  ) {
    setAssignments((prev) => {
      const moving = prev.find((item) => item.id === movingAssignmentId)
      if (!moving) return prev

      const date = moving.date
      const sameDay = prev.filter((item) => item.date === date)
      const otherDays = prev.filter((item) => item.date !== date)

      const sourceList = sortAssignments(
        sameDay.filter((item) => item.riderId === moving.riderId && item.id !== moving.id)
      )

      const targetListBase = sortAssignments(
        sameDay.filter(
          (item) => item.riderId === targetRiderId && item.id !== moving.id
        )
      )

      let targetIndex = targetListBase.length
      if (overAssignmentId) {
        const overIndex = targetListBase.findIndex((item) => item.id === overAssignmentId)
        if (overIndex !== -1) targetIndex = overIndex
      }

      const movingUpdated: Assignment = {
        ...moving,
        riderId: targetRiderId,
      }

      const targetList = [...targetListBase]
      targetList.splice(targetIndex, 0, movingUpdated)

      const rebuilt = RIDERS.flatMap((rider) => {
        if (rider.id === moving.riderId && moving.riderId !== targetRiderId) {
          return normalizeOrders(sourceList)
        }

        if (rider.id === targetRiderId) {
          return normalizeOrders(targetList)
        }

        return normalizeOrders(
          sortAssignments(sameDay.filter((item) => item.riderId === rider.id))
        )
      })

      return [...otherDays, ...rebuilt]
    })
  }

  function reorderWithinRider(
    movingAssignmentId: string,
    riderId: string,
    overAssignmentId?: string | null
  ) {
    setAssignments((prev) => {
      const moving = prev.find((item) => item.id === movingAssignmentId)
      if (!moving) return prev

      const date = moving.date
      const sameDay = prev.filter((item) => item.date === date)
      const otherDays = prev.filter((item) => item.date !== date)

      const riderList = sortAssignments(
        sameDay.filter((item) => item.riderId === riderId)
      )

      const fromIndex = riderList.findIndex((item) => item.id === moving.id)
      if (fromIndex === -1) return prev

      let toIndex = riderList.length - 1
      if (overAssignmentId) {
        const index = riderList.findIndex((item) => item.id === overAssignmentId)
        if (index !== -1) toIndex = index
      }

      const reordered = [...riderList]
      const [removed] = reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, removed)

      const rebuilt = RIDERS.flatMap((rider) => {
        if (rider.id === riderId) {
          return normalizeOrders(reordered)
        }

        return normalizeOrders(
          sortAssignments(sameDay.filter((item) => item.riderId === rider.id))
        )
      })

      return [...otherDays, ...rebuilt]
    })
  }

  function moveAssignmentToTableCell(
    movingAssignmentId: string,
    horseId: string,
    date: string
  ) {
    setAssignments((prev) => {
      const moving = prev.find((item) => item.id === movingAssignmentId)
      if (!moving) return prev

      const withoutCurrent = prev.filter((item) => item.id !== movingAssignmentId)
      const withoutTargetHorseDay = withoutCurrent.filter(
        (item) => !(item.horseId === horseId && item.date === date)
      )

      const targetList = sortAssignments(
        withoutTargetHorseDay.filter(
          (item) => item.date === date && item.riderId === moving.riderId
        )
      )

      const updated: Assignment = {
        ...moving,
        id: `${horseId}-${date}`,
        horseId,
        date,
        order: targetList.length,
      }

      const afterInsert = [...withoutTargetHorseDay, updated]
      const rebuiltSource = rebuildOrdersForDay(afterInsert, moving.date)
      return moving.date === date ? rebuiltSource : rebuildOrdersForDay(rebuiltSource, date)
    })

    setSelectedDate(date)
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as ActiveDrag
    if (!data) return
    setActiveDrag(data)
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as ActiveDrag
    const over = event.over

    setActiveDrag(null)

    if (!activeData || !over) return

    const overData = over.data.current as DropCellData | undefined

    if (activeData.kind === 'template-ride') {
      if (overData?.kind === 'table-cell') {
        upsertAssignment(overData.horseId, overData.date, activeData.riderId, activeData.type)
      }
      return
    }

    if (activeData.kind === 'template-no-rider') {
      if (overData?.kind === 'table-cell') {
        upsertAssignment(overData.horseId, overData.date, activeData.riderId, null)
      }
      return
    }

    if (activeData.kind === 'day-assignment') {
      if (overData?.kind === 'table-cell') {
        moveAssignmentToTableCell(activeData.assignmentId, overData.horseId, overData.date)
        return
      }

      const overId = String(over.id)

      if (overId.startsWith('container-')) {
        const targetRiderId = overId.replace('container-', '')
        const moving = assignmentsById.get(activeData.assignmentId)
        if (!moving) return

        if (moving.riderId === targetRiderId) {
          reorderWithinRider(activeData.assignmentId, targetRiderId, null)
        } else {
          moveDayAssignmentBetweenRiders(activeData.assignmentId, targetRiderId, null)
        }
        return
      }

      const overAssignment = assignmentsById.get(overId)
      const moving = assignmentsById.get(activeData.assignmentId)

      if (overAssignment && moving && overAssignment.date === moving.date) {
        if (moving.riderId === overAssignment.riderId) {
          reorderWithinRider(activeData.assignmentId, overAssignment.riderId, overAssignment.id)
        } else {
          moveDayAssignmentBetweenRiders(activeData.assignmentId, overAssignment.riderId, overAssignment.id)
        }
      }
    }
  }

  const totalPlannedThisWeek = assignments.filter((item) => weekDates.includes(item.date)).length

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="planner-page">
        <div className="planner-top">
          <div>
            <div className="planner-kicker">Weekly planner</div>
            <h1>Rider planning</h1>
            <p>{formatWeekRange(currentWeekStart)}</p>
          </div>

          <div className="planner-actions">
            <button type="button" className="planner-btn" onClick={goPreviousWeek}>
              Previous
            </button>
            <button type="button" className="planner-btn planner-btn-dark" onClick={goNextWeek}>
              Next
            </button>
            <button type="button" className="planner-btn" onClick={clearWeek}>
              Clear
            </button>
          </div>
        </div>

        <div className="planner-toolbar">
          <input
            className="planner-search"
            value={horseSearch}
            onChange={(e) => setHorseSearch(e.target.value)}
            placeholder="Search horse..."
          />

          <div className="planner-count">{totalPlannedThisWeek} planned this week</div>
        </div>

        <div className="planner-layout">
          <section className="planner-table-wrap">
            <div
              className="planner-table"
              style={{
                gridTemplateColumns: `180px repeat(${weekDates.length}, minmax(110px, 1fr))`,
              }}
            >
              <div className="planner-head planner-sticky-left planner-horse-head">
                Sport horses
              </div>

              {weekDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={`planner-head planner-day-head ${selectedDate === date ? 'active' : ''}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <strong>{parseIsoDateLocal(date).toLocaleDateString('en-GB', { weekday: 'short' })}</strong>
                  <span>{parseIsoDateLocal(date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>
                </button>
              ))}

              {loadingHorses ? (
                <div className="planner-empty-row">Loading horses...</div>
              ) : filteredHorses.length === 0 ? (
                <div className="planner-empty-row">No sport horses found.</div>
              ) : (
                filteredHorses.map((horse) => (
                  <Fragment key={horse.id}>
                    <div className="planner-horse planner-sticky-left">{horse.name}</div>

                    {weekDates.map((date) => {
                      const item = getCellAssignment(horse.id, date)

                      return (
                        <PlannerDropCell
                          key={`${horse.id}-${date}`}
                          horseId={horse.id}
                          date={date}
                          isSelectedDay={selectedDate === date}
                        >
                          {!item ? (
                            <button
                              type="button"
                              className="planner-drop"
                              onClick={() => openQuickAssign(horse.id, horse.name, date)}
                            >
                              Drop
                            </button>
                          ) : (
                            <TableAssignmentCard
                              assignment={item}
                              rider={getRider(item.riderId)}
                              onOpen={(assignmentId) => setEditState({ assignmentId })}
                              onDelete={removeAssignment}
                            />
                          )}
                        </PlannerDropCell>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </div>
          </section>

          <aside className="planner-side">
            <div className="planner-side-card">
              <div className="planner-side-head">
                <h2>Riders</h2>
                <p>{selectedDate ? formatDayLabel(selectedDate) : '—'}</p>
              </div>

              <div className="planner-riders">
                {selectedDayByRider.map(({ rider, items }) => (
                  <div key={rider.id} className={`planner-rider-block ${rider.isNoRider ? 'planner-rider-block-black' : ''}`}>
                    <div className="planner-rider-top">
                      <div>
                        <strong>{rider.name}</strong>
                        <span>
                          {items.length} horses · {formatTotalTime(items)}
                        </span>
                      </div>
                    </div>

                    <div className="planner-chip-row">
                      {rider.isNoRider ? (
                        <DraggableNoRiderChip rider={rider} />
                      ) : (
                        RIDE_TYPES.map((type) => (
                          <DraggableRideChip key={type} rider={rider} type={type} />
                        ))
                      )}
                    </div>

                    <div className="planner-list-shell">
                      <div className="planner-list-head">Order for the day</div>

                      <SortableContext
                        items={items.map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <RiderListDropZone riderId={rider.id}>
                          {items.length === 0 ? (
                            <div className="planner-list-empty">No horses yet</div>
                          ) : (
                            items.map((item) => (
                              <SortableDayAssignment
                                key={item.id}
                                assignment={item}
                                horseName={horseNameById.get(item.horseId) ?? 'Unknown horse'}
                                rider={rider}
                                onOpen={(assignmentId) => setEditState({ assignmentId })}
                              />
                            ))
                          )}
                        </RiderListDropZone>
                      </SortableContext>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {quickAssign && (
          <div className="planner-modal-backdrop" onClick={() => setQuickAssign(null)}>
            <div className="planner-modal-simple" onClick={(e) => e.stopPropagation()}>
              <div className="planner-modal-simple-top">
                <div>
                  <div className="planner-kicker">Quick assign</div>
                  <h3>{quickAssign.horseName}</h3>
                  <p>{formatDayLabel(quickAssign.date)}</p>
                </div>

                <button
                  type="button"
                  className="planner-close"
                  onClick={() => setQuickAssign(null)}
                >
                  ×
                </button>
              </div>

              <div className="planner-modal-simple-list">
                {RIDERS.map((rider) => (
                  <div key={rider.id} className="planner-modal-simple-row">
                    <div className="planner-modal-simple-name">{rider.name}</div>

                    <div className="planner-chip-row">
                      {rider.isNoRider ? (
                        <button
                          type="button"
                          className="planner-chip planner-chip-black"
                          onClick={() => quickAssignRide(rider.id, null)}
                        >
                          NO RIDER
                        </button>
                      ) : (
                        RIDE_TYPES.map((type) => (
                          <button
                            key={type}
                            type="button"
                            className={`planner-chip rider-${rider.color} type-${cssTypeClass(type)}`}
                            onClick={() => quickAssignRide(rider.id, type)}
                          >
                            {type}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {editAssignment && (
          <EditAssignmentModal
            assignment={editAssignment}
            horseName={horseNameById.get(editAssignment.horseId) ?? 'Unknown horse'}
            onClose={() => setEditState(null)}
            onSave={updateAssignmentFromModal}
            onDelete={removeAssignment}
          />
        )}

        <DragOverlay>
          {activeDrag?.kind === 'template-ride' ? (
            <div
              className={`planner-chip rider-${getRider(activeDrag.riderId)?.color ?? 'norider'} type-${cssTypeClass(activeDrag.type)}`}
            >
              {getRider(activeDrag.riderId)?.name} · {activeDrag.type}
            </div>
          ) : activeDrag?.kind === 'template-no-rider' ? (
            <div className="planner-chip planner-chip-black">NO RIDER</div>
          ) : activeDrag?.kind === 'day-assignment' ? (
            <div className="planner-chip planner-chip-overlay">Move horse</div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

function RiderListDropZone({
  riderId,
  children,
}: {
  riderId: string
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${riderId}`,
  })

  return (
    <div ref={setNodeRef} className={`planner-list ${isOver ? 'drag-over' : ''}`}>
      {children}
    </div>
  )
}

function EditAssignmentModal({
  assignment,
  horseName,
  onClose,
  onSave,
  onDelete,
}: {
  assignment: Assignment
  horseName: string
  onClose: () => void
  onSave: (values: {
    assignmentId: string
    riderId: string
    type: RideType | null
    minutes: number
  }) => void
  onDelete: (assignmentId: string) => void
}) {
  const [riderId, setRiderId] = useState(assignment.riderId)
  const [type, setType] = useState<RideType | null>(assignment.type)
  const [minutes, setMinutes] = useState(String(assignment.minutes))
  const selectedRider = getRider(riderId)

  useEffect(() => {
    setRiderId(assignment.riderId)
    setType(assignment.type)
    setMinutes(String(assignment.minutes))
  }, [assignment])

  function save() {
    const parsedMinutes = Math.max(1, Number(minutes) || DEFAULT_RIDE_MINUTES)

    onSave({
      assignmentId: assignment.id,
      riderId,
      type: selectedRider?.isNoRider ? null : type ?? 'Flatwork',
      minutes: parsedMinutes,
    })
  }

  return (
    <div className="planner-modal-backdrop" onClick={onClose}>
      <div className="planner-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="planner-modal-simple-top">
          <div>
            <div className="planner-kicker">Edit assignment</div>
            <h3>{horseName}</h3>
            <p>{formatDayLabel(assignment.date)}</p>
          </div>

          <button type="button" className="planner-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="planner-form-group">
          <label className="planner-form-label">Rider</label>
          <div className="planner-select-grid">
            {RIDERS.map((rider) => (
              <button
                key={rider.id}
                type="button"
                className={`planner-select-btn ${riderId === rider.id ? 'active' : ''} ${rider.isNoRider ? 'black' : ''}`}
                onClick={() => {
                  setRiderId(rider.id)
                  if (rider.isNoRider) setType(null)
                  if (!rider.isNoRider && !type) setType('Flatwork')
                }}
              >
                {rider.name}
              </button>
            ))}
          </div>
        </div>

        {!selectedRider?.isNoRider && (
          <div className="planner-form-group">
            <label className="planner-form-label">Type</label>
            <div className="planner-select-grid">
              {RIDE_TYPES.map((rideType) => (
                <button
                  key={rideType}
                  type="button"
                  className={`planner-select-btn ${type === rideType ? 'active' : ''}`}
                  onClick={() => setType(rideType)}
                >
                  {rideType}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="planner-form-group">
          <label className="planner-form-label">Minutes</label>
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="planner-minutes-input"
          />
        </div>

        <div className="planner-edit-actions">
          <button
            type="button"
            className="planner-btn planner-btn-delete"
            onClick={() => onDelete(assignment.id)}
          >
            Delete
          </button>

          <div className="planner-edit-actions-right">
            <button type="button" className="planner-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="planner-btn planner-btn-dark" onClick={save}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}