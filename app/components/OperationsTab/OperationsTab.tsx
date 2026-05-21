'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import TodayView from './TodayView'
import TimelineBoard from './TimelineBoard'
import MovementPlanning from './MovementPlanning'
import StaffView from './StaffView'
import RulesView from './RulesView'
import './OperationsTab.css'

export type View = 'overview' | 'timeline' | 'movement' | 'staff' | 'rules'

export type Staff = {
  id: string
  name: string
  role: string | null
  active: boolean | null
  start_time: string | null
  end_time: string | null
  works_monday: boolean | null
  works_tuesday: boolean | null
  works_wednesday: boolean | null
  works_thursday: boolean | null
  works_friday: boolean | null
  works_saturday: boolean | null
  works_sunday: boolean | null
  allowed_task_types: string[] | null
}

export type StaffDayStatus = {
  id?: string
  staff_id: string
  date: string
  status: 'available' | 'late' | 'absent' | 'holiday' | 'sick' | 'half_day'
  late_from?: string | null
  available_from: string | null
  available_until: string | null
  note: string | null
}

export type Horse = {
  id: string
  name: string | null
  stable_location: string | null
  box_number: string | null
  active: boolean | null
  horse_type: string | null
}

export type DailyStatus = {
  id?: string
  horse_id: string
  date: string
  vet_visit: boolean
  stay_inside: boolean
  medication: boolean
  skip_walker: boolean
  skip_turnout: boolean
  notes: string | null
}

export type RidingPlan = {
  id: string
  horse_id: string
  date: string
  rider_name: string
  ride_type: string | null
  minutes: number | null
  sort_order: number | null
}

export type RidingPlanWithHorse = RidingPlan & {
  horseName: string
  stableLocation: string
  boxNumber: string | null
}

export type StableTask = {
  id: string
  date: string
  horse_id: string | null
  title: string
  task_type: string | null
  assigned_to: string | null
  starts_at: string | null
  ends_at: string | null
  status: string | null
  auto_generated: boolean | null
  notes: string | null
  completed_at?: string | null
  completed_by?: string | null
  priority: number | null
}

export type MovementPlan = {
  id: string
  horse_id: string
  date: string
  movement_type: string
  starts_at: string | null
  ends_at: string | null
  assigned_to: string | null
  notes: string | null
}

export type DailyTask = {
  id: string
  name: string
  task_type: string
  timing_required: boolean | null
  start_time: string | null
  duration_minutes: number | null
  priority: number | null
  primary_staff: string | null
  fallback_staff: string[] | null
  active: boolean | null
  notes: string | null
  sort_order: number | null
}

export type RecurringTask = {
  id: string
  name: string
  task_type: string
  frequency_type: 'daily' | 'weekly' | 'monthly' | 'every_x_days' | string
  interval_days: number | null
  next_due_date: string | null
  timing_required: boolean | null
  start_time: string | null
  duration_minutes: number | null
  priority: number | null
  primary_staff: string | null
  fallback_staff: string[] | null
  active: boolean | null
  notes: string | null
}

export type Workflow = {
  id: string
  name: string
  workflow_type: string
  active: boolean | null
  notes: string | null
}

export type WorkflowStep = {
  id: string
  workflow_id: string
  name: string
  task_type: string
  offset_minutes: number | null
  duration_minutes: number | null
  priority: number | null
  primary_staff: string | null
  fallback_staff: string[] | null
  condition: string | null
  sort_order: number | null
  active: boolean | null
}

const views: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'movement', label: 'Movement' },
  { key: 'staff', label: 'Staff' },
  { key: 'rules', label: 'Tasks' },
]

const DEFAULT_FALLBACK_STAFF = ['George', 'Lenne', 'Alessia', 'Sandro', 'Sofia', 'Lot', 'Zanna']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function addDaysIso(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function getWorkKeyForDate(date: string) {
  const day = new Date(`${date}T12:00:00`).getDay()
  if (day === 0) return 'works_sunday'
  if (day === 1) return 'works_monday'
  if (day === 2) return 'works_tuesday'
  if (day === 3) return 'works_wednesday'
  if (day === 4) return 'works_thursday'
  if (day === 5) return 'works_friday'
  return 'works_saturday'
}

function buildDateTime(date: string, hour: number, minute: number) {
  const d = new Date(`${date}T00:00:00`)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function buildDateTimeFromTime(date: string, time: string | null) {
  if (!time) return null
  return new Date(`${date}T${time.slice(0, 5)}:00`).toISOString()
}

function addMinutes(iso: string, minutes: number) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + minutes)
  return d.toISOString()
}

function durationMinutes(start: string | null, end: string | null) {
  if (!start || !end) return 30
  return Math.max(5, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
}

function overlaps(startA: string, endA: string, startB: string | null, endB: string | null) {
  if (!startB || !endB) return false
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB)
}

function findFreeSlot(
  existingTasks: { starts_at: string | null; ends_at: string | null }[],
  wantedStart: string,
  duration: number,
) {
  let start = new Date(wantedStart)
  let end = new Date(start)
  end.setMinutes(end.getMinutes() + duration)

  const sorted = [...existingTasks]
    .filter((task) => task.starts_at && task.ends_at)
    .sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime())

  let changed = true

  while (changed) {
    changed = false

    for (const task of sorted) {
      if (overlaps(start.toISOString(), end.toISOString(), task.starts_at, task.ends_at)) {
        start = new Date(task.ends_at!)
        end = new Date(start)
        end.setMinutes(end.getMinutes() + duration)
        changed = true
      }
    }
  }

  return {
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  }
}

function isDue(date: string, task: RecurringTask) {
  if (task.active === false) return false
  if (!task.next_due_date) return true
  return task.next_due_date <= date
}

function isTerryRider(riderName: string) {
  return riderName.trim().toLowerCase().includes('terry')
}

export default function OperationsTab() {
  const [activeView, setActiveView] = useState<View>('overview')
  const [selectedDate, setSelectedDate] = useState(todayIso())

  const [staff, setStaff] = useState<Staff[]>([])
  const [staffStatuses, setStaffStatuses] = useState<Record<string, StaffDayStatus>>({})
  const [horses, setHorses] = useState<Horse[]>([])
  const [statuses, setStatuses] = useState<Record<string, DailyStatus>>({})
  const [ridingPlans, setRidingPlans] = useState<RidingPlan[]>([])
  const [stableTasks, setStableTasks] = useState<StableTask[]>([])
  const [movementPlans, setMovementPlans] = useState<MovementPlan[]>([])

  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([])
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const workKey = getWorkKeyForDate(selectedDate) as keyof Staff

  const dayStaff = useMemo(() => {
    return staff.filter((person) => {
      const dayStatus = staffStatuses[person.id]
      if (person.active === false) return false
      if (dayStatus?.status === 'absent') return false
      if (dayStatus?.status === 'holiday') return false
      if (dayStatus?.status === 'sick') return false
      return Boolean(person[workKey])
    })
  }, [staff, staffStatuses, workKey])

  const absentStaff = useMemo(() => {
    return staff.filter((person) => {
      const s = staffStatuses[person.id]?.status
      return s === 'absent' || s === 'holiday' || s === 'sick'
    })
  }, [staff, staffStatuses])

  const sportHorses = useMemo(() => {
    return horses.filter((horse) => {
      const location = (horse.stable_location || '').toLowerCase()
      return horse.active !== false && location.includes('47')
    })
  }, [horses])

  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse])), [horses])

  const ridingPlansWithHorse = useMemo<RidingPlanWithHorse[]>(() => {
    return ridingPlans
      .map((plan) => {
        const horse = horseById.get(plan.horse_id)
        return {
          ...plan,
          horseName: horse?.name || 'unknown horse',
          stableLocation: horse?.stable_location || 'no location',
          boxNumber: horse?.box_number || null,
        }
      })
      .sort((a, b) => {
        if (a.rider_name !== b.rider_name) return a.rider_name.localeCompare(b.rider_name)
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
  }, [ridingPlans, horseById])

  const tasksByPerson = useMemo(() => {
    const grouped: Record<string, StableTask[]> = {}

    stableTasks.forEach((task) => {
      const key = task.assigned_to || 'Unassigned'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(task)
    })

    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => String(a.starts_at || '').localeCompare(String(b.starts_at || '')))
    })

    return grouped
  }, [stableTasks])

  useEffect(() => {
    loadData()
  }, [selectedDate])

  async function loadData() {
    setLoading(true)

    const [
      staffResult,
      staffStatusResult,
      horsesResult,
      statusResult,
      ridingResult,
      tasksResult,
      movementResult,
      dailyTasksResult,
      recurringTasksResult,
      workflowsResult,
      workflowStepsResult,
    ] = await Promise.all([
      supabase.from('staff').select('*').order('name'),
      supabase.from('staff_day_status').select('*').eq('date', selectedDate),
      supabase.from('horses').select('id,name,stable_location,box_number,active,horse_type').order('name'),
      supabase.from('horse_daily_status').select('*').eq('date', selectedDate),
      supabase.from('riding_planning').select('*').eq('date', selectedDate).order('rider_name').order('sort_order'),
      supabase.from('stable_tasks').select('*').eq('date', selectedDate).order('starts_at'),
      supabase.from('horse_movement_planning').select('*').eq('date', selectedDate).order('starts_at'),
      supabase.from('daily_tasks').select('*').order('sort_order'),
      supabase.from('recurring_tasks').select('*').order('priority', { ascending: false }),
      supabase.from('workflows').select('*').order('name'),
      supabase.from('workflow_steps').select('*').order('sort_order'),
    ])

    if (staffResult.data) setStaff(staffResult.data as Staff[])
    if (horsesResult.data) setHorses(horsesResult.data as Horse[])
    if (ridingResult.data) setRidingPlans(ridingResult.data as RidingPlan[])
    if (tasksResult.data) setStableTasks(tasksResult.data as StableTask[])
    if (movementResult.data) setMovementPlans(movementResult.data as MovementPlan[])
    if (dailyTasksResult.data) setDailyTasks(dailyTasksResult.data as DailyTask[])
    if (recurringTasksResult.data) setRecurringTasks(recurringTasksResult.data as RecurringTask[])
    if (workflowsResult.data) setWorkflows(workflowsResult.data as Workflow[])
    if (workflowStepsResult.data) setWorkflowSteps(workflowStepsResult.data as WorkflowStep[])

    if (staffStatusResult.data) {
      const mapped: Record<string, StaffDayStatus> = {}
      ;(staffStatusResult.data as StaffDayStatus[]).forEach((status) => {
        mapped[status.staff_id] = status
      })
      setStaffStatuses(mapped)
    } else {
      setStaffStatuses({})
    }

    if (statusResult.data) {
      const mapped: Record<string, DailyStatus> = {}
      ;(statusResult.data as DailyStatus[]).forEach((status) => {
        mapped[status.horse_id] = status
      })
      setStatuses(mapped)
    } else {
      setStatuses({})
    }

    setLoading(false)
  }

  function getStatus(horseId: string): DailyStatus {
    return (
      statuses[horseId] || {
        horse_id: horseId,
        date: selectedDate,
        vet_visit: false,
        stay_inside: false,
        medication: false,
        skip_walker: false,
        skip_turnout: false,
        notes: null,
      }
    )
  }

  function updateStatus(horseId: string, patch: Partial<DailyStatus>) {
    setStatuses((prev) => ({
      ...prev,
      [horseId]: {
        ...getStatus(horseId),
        ...patch,
      },
    }))
  }

  async function saveStatuses() {
    setSaving(true)

    const rows = Object.values(statuses).map((status) => ({
      horse_id: status.horse_id,
      date: selectedDate,
      vet_visit: status.vet_visit,
      stay_inside: status.stay_inside,
      medication: status.medication,
      skip_walker: status.skip_walker,
      skip_turnout: status.skip_turnout,
      notes: status.notes || null,
    }))

    if (rows.length > 0) {
      const { error } = await supabase.from('horse_daily_status').upsert(rows, {
        onConflict: 'horse_id,date',
      })

      if (error) alert(`Save error: ${error.message}`)
    }

    setSaving(false)
    await loadData()
  }

  function staffAvailableNames() {
    return dayStaff.map((person) => person.name)
  }

  function safeAssignedPerson(preferred: string) {
    const available = staffAvailableNames()
    if (available.includes(preferred)) return preferred
    return available[0] || preferred
  }

  async function generateTasks() {
    setGenerating(true)

    await saveStatuses()
    await supabase.from('stable_tasks').delete().eq('date', selectedDate).eq('auto_generated', true)

    const rows: any[] = []
    const personTasks: Record<string, { starts_at: string | null; ends_at: string | null }[]> = {}

    stableTasks
      .filter((task) => !task.auto_generated && task.assigned_to)
      .forEach((task) => {
        const person = task.assigned_to!
        if (!personTasks[person]) personTasks[person] = []
        personTasks[person].push({ starts_at: task.starts_at, ends_at: task.ends_at })
      })

    function addTask(input: {
      title: string
      task_type: string
      assigned_to: string
      start: string
      duration: number
      horse_id?: string | null
      notes?: string | null
      fallbackStaff?: string[]
      fixedPerson?: boolean
      priority?: number
    }) {
      const availableNames = staffAvailableNames()

      function canDoTask(personName: string) {
        const person = staff.find((item) => item.name === personName)
        if (!person) return true

        const allowed = person.allowed_task_types || []
        if (allowed.length === 0) return true

        return allowed.includes(input.task_type)
      }

      const candidates = input.fixedPerson
        ? [safeAssignedPerson(input.assigned_to)]
        : [input.assigned_to, ...(input.fallbackStaff || DEFAULT_FALLBACK_STAFF)]
            .filter((v, i, arr) => v && arr.indexOf(v) === i)
            .filter((name) => availableNames.length === 0 || availableNames.includes(name))
            .filter((name) => canDoTask(name))

      const finalCandidates = candidates.length
        ? candidates
        : availableNames.filter((name) => canDoTask(name))

      const fallbackCandidates = finalCandidates.length ? finalCandidates : [input.assigned_to]

      let bestPerson = fallbackCandidates[0]
      let bestSlot = findFreeSlot(personTasks[bestPerson] || [], input.start, input.duration)

      fallbackCandidates.forEach((person) => {
        const slot = findFreeSlot(personTasks[person] || [], input.start, input.duration)
        if (new Date(slot.starts_at).getTime() < new Date(bestSlot.starts_at).getTime()) {
          bestPerson = person
          bestSlot = slot
        }
      })

      const task = {
        date: selectedDate,
        horse_id: input.horse_id || null,
        title: input.title,
        task_type: input.task_type,
        assigned_to: bestPerson,
        starts_at: bestSlot.starts_at,
        ends_at: bestSlot.ends_at,
        auto_generated: true,
        status: 'pending',
        notes: input.notes || null,
        priority: input.priority || 50,
      }

      rows.push(task)

      if (!personTasks[bestPerson]) personTasks[bestPerson] = []
      personTasks[bestPerson].push({ starts_at: task.starts_at, ends_at: task.ends_at })
    }

    dailyTasks
      .filter((task) => task.active !== false)
      .forEach((task, index) => {
        const preferredStart = task.timing_required
          ? buildDateTimeFromTime(selectedDate, task.start_time)
          : buildDateTime(selectedDate, 7 + Math.floor(index / 3), (index % 3) * 20)

        addTask({
          title: task.name,
          task_type: task.task_type || 'manual',
          assigned_to: task.primary_staff || 'George',
          start: preferredStart || buildDateTime(selectedDate, 8, 0),
          duration: task.duration_minutes || 30,
          notes: task.notes,
          fallbackStaff: task.fallback_staff || [],
          fixedPerson: false,
          priority: task.priority || 50,
        })
      })

    recurringTasks
      .filter((task) => isDue(selectedDate, task))
      .forEach((task, index) => {
        const preferredStart = task.timing_required
          ? buildDateTimeFromTime(selectedDate, task.start_time)
          : buildDateTime(selectedDate, 11 + Math.floor(index / 2), (index % 2) * 30)

        addTask({
          title: task.name,
          task_type: task.task_type || 'manual',
          assigned_to: task.primary_staff || 'George',
          start: preferredStart || buildDateTime(selectedDate, 11, 0),
          duration: task.duration_minutes || 30,
          notes: task.notes,
          fallbackStaff: task.fallback_staff || [],
          fixedPerson: false,
          priority: task.priority || 60,
        })
      })

    movementPlans.forEach((move) => {
      const horse = horseById.get(move.horse_id)
      if (!move.starts_at || !move.ends_at) return

      const status = getStatus(move.horse_id)
      if (move.movement_type === 'walker' && status.skip_walker) return
      if ((move.movement_type === 'field' || move.movement_type === 'sand_paddock') && status.skip_turnout) return
      if (status.stay_inside && move.movement_type !== 'inside') return

      addTask({
        title: `${horse?.name || 'Horse'} · ${move.movement_type}`,
        task_type: move.movement_type,
        assigned_to: 'Lenne',
        start: move.starts_at,
        duration: durationMinutes(move.starts_at, move.ends_at),
        horse_id: move.horse_id,
        notes: horse?.name || null,
        fallbackStaff: ['Lenne', 'Lot', 'Zanna', 'Alessia', 'George'],
        priority: 70,
      })
    })

    const rideWorkflow = workflows.find(
      (workflow) =>
        workflow.active !== false &&
        ['ride', 'riding'].includes((workflow.workflow_type || '').toLowerCase()),
    )

    const rideWorkflowSteps = rideWorkflow
      ? workflowSteps
          .filter((step) => step.workflow_id === rideWorkflow.id && step.active !== false)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      : []

    ridingPlansWithHorse.forEach((plan, index) => {
      const rideStart = buildDateTime(selectedDate, 10 + index, 0)
      const rideMinutes = plan.minutes || 40
      const terryRide = isTerryRider(plan.rider_name)

      rideWorkflowSteps.forEach((step) => {
        const isRide = step.task_type === 'ride'
        const isAfter =
          step.offset_minutes !== null &&
          step.offset_minutes >= 0 &&
          step.name.toLowerCase().includes('after')

        const assignedPerson = isRide
          ? plan.rider_name
          : terryRide
            ? step.primary_staff || 'Lenne'
            : plan.rider_name

        const fallbackPeople = isRide ? [] : terryRide ? step.fallback_staff || [] : [plan.rider_name]

        addTask({
          title: `${step.name} ${plan.horseName}`,
          task_type: step.task_type || 'groom',
          assigned_to: assignedPerson,
          start: addMinutes(rideStart, isRide ? 0 : isAfter ? rideMinutes : step.offset_minutes || 0),
          duration: isRide ? rideMinutes : step.duration_minutes || 10,
          horse_id: plan.horse_id,
          notes: isRide ? plan.ride_type || null : `For ${plan.rider_name}`,
          fallbackStaff: fallbackPeople,
          fixedPerson: isRide || !terryRide,
          priority: step.priority || 70,
        })
      })
    })

    Object.values(statuses).forEach((status) => {
      const horse = horseById.get(status.horse_id)

      if (status.medication) {
        addTask({
          title: `Medication ${horse?.name || 'Horse'}`,
          task_type: 'medical',
          assigned_to: 'Sofia',
          start: buildDateTime(selectedDate, 8, 0),
          duration: 10,
          horse_id: status.horse_id,
          notes: status.notes || null,
          fixedPerson: true,
          priority: 100,
        })
      }

      if (status.vet_visit) {
        addTask({
          title: `Vet prep ${horse?.name || 'Horse'}`,
          task_type: 'medical',
          assigned_to: 'Sofia',
          start: buildDateTime(selectedDate, 9, 30),
          duration: 15,
          horse_id: status.horse_id,
          notes: 'Stay inside',
          fixedPerson: true,
          priority: 95,
        })
      }

      if (status.stay_inside) {
        addTask({
          title: `Keep inside ${horse?.name || 'Horse'}`,
          task_type: 'manual',
          assigned_to: 'Lenne',
          start: buildDateTime(selectedDate, 8, 5),
          duration: 5,
          horse_id: status.horse_id,
          notes: 'Do not turnout',
          fallbackStaff: ['Lenne', 'Alessia'],
          priority: 95,
        })
      }
    })

    if (rows.length > 0) {
      const { error } = await supabase.from('stable_tasks').insert(rows)
      if (error) alert(`Generate error: ${error.message}`)
    }

    await supabase.from('planning_days').upsert(
      {
        date: selectedDate,
        status: 'generated',
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'date' },
    )

    setGenerating(false)
    await loadData()
    setActiveView('timeline')
  }

  return (
    <section className="ops-page">
      <div className="ops-hero ops-hero-clean">
        <div>
          <span className="ops-kicker">Stable Operations</span>
          <h2>Operations Planner</h2>
          <p>Plan movements, staff availability, daily tasks and generated timelines.</p>
        </div>

        <div className="ops-hero-actions">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />

          <button type="button" onClick={() => setSelectedDate(todayIso())}>
            Today
          </button>

          <button type="button" onClick={() => setSelectedDate(addDaysIso(1))}>
            Tomorrow
          </button>

          <button className="ops-generate-btn" type="button" onClick={saveStatuses}>
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button className="ops-generate-btn gold" type="button" onClick={generateTasks}>
            {generating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      <div className="ops-tabs ops-tabs-clean">
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            className={activeView === view.key ? 'active' : ''}
            onClick={() => setActiveView(view.key)}
          >
            {view.label}
          </button>
        ))}
      </div>

      {loading && <div className="ops-loading">Loading operations...</div>}

      {!loading && activeView === 'overview' && (
        <TodayView
          todayStaff={dayStaff}
          sportHorses={sportHorses}
          ridingPlans={ridingPlansWithHorse}
          getStatus={getStatus}
          updateStatus={updateStatus}
        />
      )}

      {!loading && activeView === 'timeline' && (
        <TimelineBoard
          selectedDate={selectedDate}
          allStaff={staff}
          staffStatuses={staffStatuses}
          tasksByPerson={tasksByPerson}
          onRefresh={loadData}
        />
      )}

      {!loading && activeView === 'movement' && (
        <MovementPlanning
          horses={sportHorses}
          date={selectedDate}
          movementPlans={movementPlans}
          onRefresh={loadData}
        />
      )}

      {!loading && activeView === 'staff' && (
        <StaffView
          staff={staff}
          selectedDate={selectedDate}
          staffStatuses={staffStatuses}
          onRefresh={loadData}
        />
      )}

      {!loading && activeView === 'rules' && (
        <RulesView
          staff={staff}
          dailyTasks={dailyTasks}
          recurringTasks={recurringTasks}
          workflows={workflows}
          workflowSteps={workflowSteps}
          onRefresh={loadData}
        />
      )}
    </section>
  )
}
