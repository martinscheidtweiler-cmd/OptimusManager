'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import TodayView from './TodayView'
import TimelineBoard from './TimelineBoard'
import MovementPlanning from './MovementPlanning'
import StaffView from './StaffView'
import RulesView from './RulesView'
import './OperationsTab.css'

export type View = 'today' | 'board' | 'movement' | 'staff' | 'rules'

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

const views: { key: View; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'board', label: 'Timeline' },
  { key: 'movement', label: 'Movement' },
  { key: 'staff', label: 'Staff' },
  { key: 'rules', label: 'Rules' },
]

const FALLBACK_STAFF = ['George', 'Lenne', 'Alessia', 'Sandro', 'Sofia', 'Lot', 'Zanna']

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function getTodayWorkKey() {
  const day = new Date().getDay()
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

export default function OperationsTab() {
  const [activeView, setActiveView] = useState<View>('today')
  const [staff, setStaff] = useState<Staff[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [statuses, setStatuses] = useState<Record<string, DailyStatus>>({})
  const [ridingPlans, setRidingPlans] = useState<RidingPlan[]>([])
  const [stableTasks, setStableTasks] = useState<StableTask[]>([])
  const [movementPlans, setMovementPlans] = useState<MovementPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const date = todayIso()

  const todayStaff = useMemo(() => {
    const key = getTodayWorkKey() as keyof Staff
    return staff.filter((person) => person.active !== false && person[key])
  }, [staff])

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
  }, [])

  async function loadData() {
    setLoading(true)

    const [staffResult, horsesResult, statusResult, ridingResult, tasksResult, movementResult] =
      await Promise.all([
        supabase.from('staff').select('*').order('name'),
        supabase.from('horses').select('id,name,stable_location,box_number,active,horse_type').order('name'),
        supabase.from('horse_daily_status').select('*').eq('date', date),
        supabase.from('riding_planning').select('*').eq('date', date).order('rider_name').order('sort_order'),
        supabase.from('stable_tasks').select('*').eq('date', date).order('starts_at'),
        supabase.from('horse_movement_planning').select('*').eq('date', date).order('starts_at'),
      ])

    if (staffResult.data) setStaff(staffResult.data as Staff[])
    if (horsesResult.data) setHorses(horsesResult.data as Horse[])
    if (ridingResult.data) setRidingPlans(ridingResult.data as RidingPlan[])
    if (tasksResult.data) setStableTasks(tasksResult.data as StableTask[])
    if (movementResult.data) setMovementPlans(movementResult.data as MovementPlan[])

    if (statusResult.data) {
      const mapped: Record<string, DailyStatus> = {}
      ;(statusResult.data as DailyStatus[]).forEach((status) => {
        mapped[status.horse_id] = status
      })
      setStatuses(mapped)
    }

    setLoading(false)
  }

  function getStatus(horseId: string): DailyStatus {
    return (
      statuses[horseId] || {
        horse_id: horseId,
        date,
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
      date,
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

  async function generateTasks() {
    setGenerating(true)

    await supabase.from('stable_tasks').delete().eq('date', date).eq('auto_generated', true)

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
    }) {
      const candidates = input.fixedPerson
        ? [input.assigned_to]
        : [input.assigned_to, ...(input.fallbackStaff || FALLBACK_STAFF)].filter(
            (v, i, arr) => v && arr.indexOf(v) === i,
          )

      let bestPerson = candidates[0]
      let bestSlot = findFreeSlot(personTasks[bestPerson] || [], input.start, input.duration)

      candidates.forEach((person) => {
        const slot = findFreeSlot(personTasks[person] || [], input.start, input.duration)
        if (new Date(slot.starts_at).getTime() < new Date(bestSlot.starts_at).getTime()) {
          bestPerson = person
          bestSlot = slot
        }
      })

      const task = {
        date,
        horse_id: input.horse_id || null,
        title: input.title.toLowerCase(),
        task_type: input.task_type,
        assigned_to: bestPerson,
        starts_at: bestSlot.starts_at,
        ends_at: bestSlot.ends_at,
        auto_generated: true,
        status: 'pending',
        notes: input.notes || null,
      }

      rows.push(task)

      if (!personTasks[bestPerson]) personTasks[bestPerson] = []
      personTasks[bestPerson].push({ starts_at: task.starts_at, ends_at: task.ends_at })
    }

    addTask({
      title: '47b hay / lucerne',
      task_type: 'feed',
      assigned_to: 'George',
      start: buildDateTime(date, 7, 0),
      duration: 30,
      fixedPerson: true,
    })

    addTask({
      title: '47b morning feed',
      task_type: 'feed',
      assigned_to: 'George',
      start: buildDateTime(date, 7, 45),
      duration: 25,
      fixedPerson: true,
    })

    addTask({
      title: 'muck out boxes',
      task_type: 'muck',
      assigned_to: 'George',
      start: buildDateTime(date, 8, 20),
      duration: 160,
      fallbackStaff: ['George', 'Sandro'],
    })

    const walkerGroups = [
      buildDateTime(date, 8, 10),
      buildDateTime(date, 8, 45),
      buildDateTime(date, 9, 20),
      buildDateTime(date, 9, 55),
    ]

    walkerGroups.forEach((start, index) => {
      addTask({
        title: `walker group ${index + 1}`,
        task_type: 'walker',
        assigned_to: 'Lenne',
        start,
        duration: 25,
        fallbackStaff: ['Lenne', 'Lot', 'Zanna', 'Alessia'],
      })

      addTask({
        title: `turnout group ${index + 1}`,
        task_type: 'turnout',
        assigned_to: 'Lenne',
        start: addMinutes(start, 30),
        duration: 12,
        fallbackStaff: ['Lenne', 'Lot', 'Zanna', 'Alessia', 'George'],
      })
    })

    addTask({
      title: 'field to sand paddock',
      task_type: 'paddock',
      assigned_to: 'George',
      start: buildDateTime(date, 12, 0),
      duration: 45,
      fallbackStaff: ['George', 'Sandro', 'Lenne'],
    })

    addTask({
      title: 'bring horses inside',
      task_type: 'turnout',
      assigned_to: 'George',
      start: buildDateTime(date, 16, 30),
      duration: 45,
      fallbackStaff: ['George', 'Sandro', 'Lenne'],
    })

    addTask({
      title: 'evening hay',
      task_type: 'feed',
      assigned_to: 'George',
      start: buildDateTime(date, 17, 15),
      duration: 20,
      fixedPerson: true,
    })

    addTask({
      title: 'evening feed',
      task_type: 'feed',
      assigned_to: 'George',
      start: buildDateTime(date, 17, 30),
      duration: 30,
      fixedPerson: true,
    })

    addTask({
      title: 'late hay + feed',
      task_type: 'feed',
      assigned_to: 'George',
      start: buildDateTime(date, 23, 0),
      duration: 30,
      fixedPerson: true,
    })

    movementPlans.forEach((move) => {
      const horse = horseById.get(move.horse_id)
      if (!move.starts_at || !move.ends_at) return

      addTask({
        title: `${horse?.name || 'horse'} ${move.movement_type}`,
        task_type: move.movement_type,
        assigned_to: move.assigned_to || 'Lenne',
        start: move.starts_at,
        duration: durationMinutes(move.starts_at, move.ends_at),
        horse_id: move.horse_id,
        notes: horse?.name || null,
        fallbackStaff: ['Lenne', 'Lot', 'Zanna', 'Alessia', 'George'],
      })
    })

    ridingPlansWithHorse.forEach((plan, index) => {
      const rideStart = buildDateTime(date, 10 + index, 0)

      addTask({
        title: `get ${plan.horseName}`,
        task_type: 'groom',
        assigned_to: 'Lenne',
        start: addMinutes(rideStart, -25),
        duration: 10,
        horse_id: plan.horse_id,
        notes: `for ${plan.rider_name}`,
        fallbackStaff: ['Lenne', 'Lot', 'Zanna', 'Alessia'],
      })

      addTask({
        title: `tack up ${plan.horseName}`,
        task_type: 'groom',
        assigned_to: 'Alessia',
        start: addMinutes(rideStart, -15),
        duration: 15,
        horse_id: plan.horse_id,
        notes: plan.rider_name,
        fallbackStaff: ['Alessia', 'Lot', 'Zanna'],
      })

      addTask({
        title: `ride ${plan.horseName}`,
        task_type: 'ride',
        assigned_to: plan.rider_name,
        start: rideStart,
        duration: plan.minutes || 40,
        horse_id: plan.horse_id,
        notes: plan.ride_type || null,
        fixedPerson: true,
      })

      addTask({
        title: `aftercare ${plan.horseName}`,
        task_type: 'groom',
        assigned_to: 'Alessia',
        start: addMinutes(rideStart, plan.minutes || 40),
        duration: 15,
        horse_id: plan.horse_id,
        notes: 'untack / check',
        fallbackStaff: ['Alessia', 'Lot', 'Zanna'],
      })
    })

    Object.values(statuses).forEach((status) => {
      const horse = horseById.get(status.horse_id)

      if (status.medication) {
        addTask({
          title: `medication ${horse?.name || 'horse'}`,
          task_type: 'medical',
          assigned_to: 'Sofia',
          start: buildDateTime(date, 8, 0),
          duration: 10,
          horse_id: status.horse_id,
          notes: status.notes || null,
          fixedPerson: true,
        })
      }

      if (status.vet_visit) {
        addTask({
          title: `vet prep ${horse?.name || 'horse'}`,
          task_type: 'medical',
          assigned_to: 'Sofia',
          start: buildDateTime(date, 9, 30),
          duration: 15,
          horse_id: status.horse_id,
          notes: 'stay inside',
          fixedPerson: true,
        })
      }

      if (status.stay_inside) {
        addTask({
          title: `keep inside ${horse?.name || 'horse'}`,
          task_type: 'manual',
          assigned_to: 'Lenne',
          start: buildDateTime(date, 8, 5),
          duration: 5,
          horse_id: status.horse_id,
          notes: 'do not turnout',
          fallbackStaff: ['Lenne', 'Alessia'],
        })
      }
    })

    const { error } = await supabase.from('stable_tasks').insert(rows)

    if (error) alert(`Generate error: ${error.message}`)

    setGenerating(false)
    await loadData()
    setActiveView('board')
  }

  return (
    <section className="ops-page">
      <div className="ops-hero">
        <div>
          <span className="ops-kicker">Stable Operations</span>
          <h2>Daily command center</h2>
          <p>Movement planning, stable routines, riding and staff timeline.</p>
        </div>

        <div className="ops-hero-actions">
          <button className="ops-generate-btn" type="button" onClick={saveStatuses}>
            {saving ? 'Saving...' : 'Save today'}
          </button>

          <button className="ops-generate-btn" type="button" onClick={generateTasks}>
            {generating ? 'Generating...' : 'Generate full day'}
          </button>
        </div>
      </div>

      <div className="ops-tabs">
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

      {!loading && activeView === 'today' && (
        <TodayView
          todayStaff={todayStaff}
          sportHorses={sportHorses}
          ridingPlans={ridingPlansWithHorse}
          getStatus={getStatus}
          updateStatus={updateStatus}
        />
      )}

      {!loading && activeView === 'board' && (
        <TimelineBoard allStaff={staff} tasksByPerson={tasksByPerson} onRefresh={loadData} />
      )}

      {!loading && activeView === 'movement' && (
        <MovementPlanning
          horses={sportHorses}
          staff={staff}
          date={date}
          movementPlans={movementPlans}
          onRefresh={loadData}
        />
      )}

      {!loading && activeView === 'staff' && <StaffView staff={staff} />}

      {!loading && activeView === 'rules' && <RulesView />}
    </section>
  )
}