'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { DailyTask, RecurringTask, Staff, Workflow, WorkflowStep } from './OperationsTab'

type Props = {
  staff: Staff[]
  dailyTasks: DailyTask[]
  recurringTasks: RecurringTask[]
  workflows: Workflow[]
  workflowSteps: WorkflowStep[]
  onRefresh: () => void | Promise<void>
}

type Tab = 'daily' | 'recurring' | 'workflows' | 'steps'

type DailyForm = {
  id?: string
  name: string
  task_type: string
  timing_required: boolean
  start_time: string
  duration_minutes: string
  priority: string
  primary_staff: string
  fallback_staff: string[]
  active: boolean
  notes: string
  sort_order: string
}

type RecurringForm = {
  id?: string
  name: string
  task_type: string
  frequency_type: string
  interval_days: string
  next_due_date: string
  timing_required: boolean
  start_time: string
  duration_minutes: string
  priority: string
  primary_staff: string
  fallback_staff: string[]
  active: boolean
  notes: string
}

type WorkflowForm = {
  id?: string
  name: string
  workflow_type: string
  active: boolean
  notes: string
}

type StepForm = {
  id?: string
  workflow_id: string
  name: string
  task_type: string
  offset_minutes: string
  duration_minutes: string
  priority: string
  primary_staff: string
  fallback_staff: string[]
  condition: string
  sort_order: string
  active: boolean
}

const taskTypes = ['feed', 'walker', 'turnout', 'paddock', 'ride', 'groom', 'medical', 'muck', 'stable', 'tractor', 'admin', 'manual']
const workflowTypes = ['ride', 'stable', 'vet', 'farrier', 'competition', 'medical', 'reproduction', 'custom']
const conditions = [
  '',
  'only_if_horse_in_stable',
  'prefer_horse_not_present',
  'only_if_vet_visit',
  'only_if_medication',
  'only_if_ride_planned',
  'only_if_competition',
]

function emptyDaily(): DailyForm {
  return {
    name: '',
    task_type: 'manual',
    timing_required: false,
    start_time: '',
    duration_minutes: '30',
    priority: '50',
    primary_staff: '',
    fallback_staff: [],
    active: true,
    notes: '',
    sort_order: '0',
  }
}

function emptyRecurring(): RecurringForm {
  return {
    name: '',
    task_type: 'manual',
    frequency_type: 'weekly',
    interval_days: '14',
    next_due_date: '',
    timing_required: false,
    start_time: '',
    duration_minutes: '30',
    priority: '60',
    primary_staff: '',
    fallback_staff: [],
    active: true,
    notes: '',
  }
}

function emptyWorkflow(): WorkflowForm {
  return {
    name: '',
    workflow_type: 'custom',
    active: true,
    notes: '',
  }
}

function emptyStep(workflowId = ''): StepForm {
  return {
    workflow_id: workflowId,
    name: '',
    task_type: 'manual',
    offset_minutes: '0',
    duration_minutes: '10',
    priority: '70',
    primary_staff: '',
    fallback_staff: [],
    condition: '',
    sort_order: '0',
    active: true,
  }
}

export default function RulesView({
  staff,
  dailyTasks,
  recurringTasks,
  workflows,
  workflowSteps,
  onRefresh,
}: Props) {
  const [tab, setTab] = useState<Tab>('daily')
  const [search, setSearch] = useState('')

  const [dailyForm, setDailyForm] = useState<DailyForm | null>(null)
  const [recurringForm, setRecurringForm] = useState<RecurringForm | null>(null)
  const [workflowForm, setWorkflowForm] = useState<WorkflowForm | null>(null)
  const [stepForm, setStepForm] = useState<StepForm | null>(null)

  const activeStaff = staff.filter((person) => person.active !== false)
  const q = search.trim().toLowerCase()

  const filteredDaily = useMemo(() => {
    return dailyTasks
      .filter((task) => !q || task.name.toLowerCase().includes(q) || task.task_type.toLowerCase().includes(q))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [dailyTasks, q])

  const filteredRecurring = useMemo(() => {
    return recurringTasks
      .filter((task) => !q || task.name.toLowerCase().includes(q) || task.task_type.toLowerCase().includes(q))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }, [recurringTasks, q])

  const filteredWorkflows = useMemo(() => {
    return workflows
      .filter((workflow) => !q || workflow.name.toLowerCase().includes(q) || workflow.workflow_type.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [workflows, q])

  const stepsByWorkflow = useMemo(() => {
    const grouped: Record<string, WorkflowStep[]> = {}
    workflowSteps.forEach((step) => {
      if (!grouped[step.workflow_id]) grouped[step.workflow_id] = []
      grouped[step.workflow_id].push(step)
    })
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    })
    return grouped
  }, [workflowSteps])

  function workflowName(id: string) {
    return workflows.find((workflow) => workflow.id === id)?.name || 'Unknown workflow'
  }

  function toggleFallback<T extends { fallback_staff: string[] }>(
    current: T,
    setCurrent: (next: T) => void,
    name: string,
  ) {
    const next = current.fallback_staff.includes(name)
      ? current.fallback_staff.filter((item) => item !== name)
      : [...current.fallback_staff, name]
    setCurrent({ ...current, fallback_staff: next })
  }

  async function saveDaily() {
    if (!dailyForm?.name.trim()) return alert('Name is required')
    if (dailyForm.timing_required && !dailyForm.start_time) return alert('Start time is required')

    const payload = {
      name: dailyForm.name.trim(),
      task_type: dailyForm.task_type,
      timing_required: dailyForm.timing_required,
      start_time: dailyForm.timing_required ? dailyForm.start_time || null : null,
      duration_minutes: Number(dailyForm.duration_minutes || 30),
      priority: Number(dailyForm.priority || 50),
      primary_staff: dailyForm.primary_staff || null,
      fallback_staff: dailyForm.fallback_staff,
      active: dailyForm.active,
      notes: dailyForm.notes || null,
      sort_order: Number(dailyForm.sort_order || 0),
    }

    const query = dailyForm.id
      ? supabase.from('daily_tasks').update(payload).eq('id', dailyForm.id)
      : supabase.from('daily_tasks').insert(payload)

    const { error } = await query
    if (error) return alert(error.message)
    setDailyForm(null)
    await onRefresh()
  }

  async function saveRecurring() {
    if (!recurringForm?.name.trim()) return alert('Name is required')
    if (recurringForm.timing_required && !recurringForm.start_time) return alert('Start time is required')

    const payload = {
      name: recurringForm.name.trim(),
      task_type: recurringForm.task_type,
      frequency_type: recurringForm.frequency_type,
      interval_days: recurringForm.frequency_type === 'every_x_days' ? Number(recurringForm.interval_days || 1) : null,
      next_due_date: recurringForm.next_due_date || null,
      timing_required: recurringForm.timing_required,
      start_time: recurringForm.timing_required ? recurringForm.start_time || null : null,
      duration_minutes: Number(recurringForm.duration_minutes || 30),
      priority: Number(recurringForm.priority || 60),
      primary_staff: recurringForm.primary_staff || null,
      fallback_staff: recurringForm.fallback_staff,
      active: recurringForm.active,
      notes: recurringForm.notes || null,
    }

    const query = recurringForm.id
      ? supabase.from('recurring_tasks').update(payload).eq('id', recurringForm.id)
      : supabase.from('recurring_tasks').insert(payload)

    const { error } = await query
    if (error) return alert(error.message)
    setRecurringForm(null)
    await onRefresh()
  }

  async function saveWorkflow() {
    if (!workflowForm?.name.trim()) return alert('Name is required')

    const payload = {
      name: workflowForm.name.trim(),
      workflow_type: workflowForm.workflow_type,
      active: workflowForm.active,
      notes: workflowForm.notes || null,
    }

    const query = workflowForm.id
      ? supabase.from('workflows').update(payload).eq('id', workflowForm.id)
      : supabase.from('workflows').insert(payload)

    const { error } = await query
    if (error) return alert(error.message)
    setWorkflowForm(null)
    await onRefresh()
  }

  async function saveStep() {
    if (!stepForm?.name.trim()) return alert('Name is required')
    if (!stepForm.workflow_id) return alert('Choose a workflow')

    const payload = {
      workflow_id: stepForm.workflow_id,
      name: stepForm.name.trim(),
      task_type: stepForm.task_type,
      offset_minutes: Number(stepForm.offset_minutes || 0),
      duration_minutes: Number(stepForm.duration_minutes || 10),
      priority: Number(stepForm.priority || 70),
      primary_staff: stepForm.primary_staff || null,
      fallback_staff: stepForm.fallback_staff,
      condition: stepForm.condition || null,
      sort_order: Number(stepForm.sort_order || 0),
      active: stepForm.active,
    }

    const query = stepForm.id
      ? supabase.from('workflow_steps').update(payload).eq('id', stepForm.id)
      : supabase.from('workflow_steps').insert(payload)

    const { error } = await query
    if (error) return alert(error.message)
    setStepForm(null)
    await onRefresh()
  }

  async function remove(table: string, id: string) {
    if (!confirm('Delete this item?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return alert(error.message)
    await onRefresh()
  }

  async function toggleActive(table: string, id: string, active: boolean | null) {
    const { error } = await supabase.from(table).update({ active: active === false }).eq('id', id)
    if (error) return alert(error.message)
    await onRefresh()
  }

  function DailyCard({ task }: { task: DailyTask }) {
    return (
      <article className={`task-template-card ${task.active === false ? 'disabled' : ''}`}>
        <div className="task-template-top">
          <div>
            <span className={`task-type-pill type-${task.task_type}`}>{task.task_type}</span>
            <h4>{task.name}</h4>
          </div>
          <strong>P{task.priority || 50}</strong>
        </div>

        <div className="task-template-meta">
          <div>
            <span>Timing</span>
            <b>{task.timing_required ? `${task.start_time?.slice(0, 5)} · ${task.duration_minutes} min` : `Flexible · ${task.duration_minutes} min`}</b>
          </div>
          <div>
            <span>First</span>
            <b>{task.primary_staff || 'Auto'}</b>
          </div>
          <div>
            <span>Fallback</span>
            <b>{task.fallback_staff?.length ? task.fallback_staff.join(', ') : 'None'}</b>
          </div>
        </div>

        {task.notes ? <p>{task.notes}</p> : null}

        <div className="task-template-actions">
          <button onClick={() => toggleActive('daily_tasks', task.id, task.active)}>{task.active === false ? 'Enable' : 'Disable'}</button>
          <button onClick={() => setDailyForm({
            id: task.id,
            name: task.name,
            task_type: task.task_type || 'manual',
            timing_required: Boolean(task.timing_required),
            start_time: task.start_time?.slice(0, 5) || '',
            duration_minutes: String(task.duration_minutes || 30),
            priority: String(task.priority || 50),
            primary_staff: task.primary_staff || '',
            fallback_staff: task.fallback_staff || [],
            active: task.active !== false,
            notes: task.notes || '',
            sort_order: String(task.sort_order || 0),
          })}>Edit</button>
          <button className="danger" onClick={() => remove('daily_tasks', task.id)}>Delete</button>
        </div>
      </article>
    )
  }

  function RecurringCard({ task }: { task: RecurringTask }) {
    return (
      <article className={`task-template-card ${task.active === false ? 'disabled' : ''}`}>
        <div className="task-template-top">
          <div>
            <span className={`task-type-pill type-${task.task_type}`}>{task.frequency_type}</span>
            <h4>{task.name}</h4>
          </div>
          <strong>P{task.priority || 60}</strong>
        </div>

        <div className="task-template-meta">
          <div>
            <span>Due</span>
            <b>{task.next_due_date || 'No date'}</b>
          </div>
          <div>
            <span>Timing</span>
            <b>{task.timing_required ? `${task.start_time?.slice(0, 5)} · ${task.duration_minutes} min` : `Flexible · ${task.duration_minutes} min`}</b>
          </div>
          <div>
            <span>First</span>
            <b>{task.primary_staff || 'Auto'}</b>
          </div>
        </div>

        {task.notes ? <p>{task.notes}</p> : null}

        <div className="task-template-actions">
          <button onClick={() => toggleActive('recurring_tasks', task.id, task.active)}>{task.active === false ? 'Enable' : 'Disable'}</button>
          <button onClick={() => setRecurringForm({
            id: task.id,
            name: task.name,
            task_type: task.task_type || 'manual',
            frequency_type: task.frequency_type || 'weekly',
            interval_days: String(task.interval_days || 14),
            next_due_date: task.next_due_date || '',
            timing_required: Boolean(task.timing_required),
            start_time: task.start_time?.slice(0, 5) || '',
            duration_minutes: String(task.duration_minutes || 30),
            priority: String(task.priority || 60),
            primary_staff: task.primary_staff || '',
            fallback_staff: task.fallback_staff || [],
            active: task.active !== false,
            notes: task.notes || '',
          })}>Edit</button>
          <button className="danger" onClick={() => remove('recurring_tasks', task.id)}>Delete</button>
        </div>
      </article>
    )
  }

  function WorkflowCard({ workflow }: { workflow: Workflow }) {
    const steps = stepsByWorkflow[workflow.id] || []

    return (
      <article className={`task-template-card ${workflow.active === false ? 'disabled' : ''}`}>
        <div className="task-template-top">
          <div>
            <span className="task-type-pill">{workflow.workflow_type}</span>
            <h4>{workflow.name}</h4>
          </div>
          <strong>{steps.length}</strong>
        </div>

        {workflow.notes ? <p>{workflow.notes}</p> : null}

        <div className="workflow-step-preview">
          {steps.length === 0 ? <span>No steps yet</span> : steps.slice(0, 6).map((step) => (
            <span key={step.id}>{step.sort_order}. {step.name} · {step.offset_minutes} min</span>
          ))}
        </div>

        <div className="task-template-actions">
          <button onClick={() => toggleActive('workflows', workflow.id, workflow.active)}>{workflow.active === false ? 'Enable' : 'Disable'}</button>
          <button onClick={() => setWorkflowForm({
            id: workflow.id,
            name: workflow.name,
            workflow_type: workflow.workflow_type || 'custom',
            active: workflow.active !== false,
            notes: workflow.notes || '',
          })}>Edit</button>
          <button onClick={() => {
            setTab('steps')
            setStepForm(emptyStep(workflow.id))
          }}>+ Step</button>
          <button className="danger" onClick={() => remove('workflows', workflow.id)}>Delete</button>
        </div>
      </article>
    )
  }

  function StepCard({ step }: { step: WorkflowStep }) {
    return (
      <article className={`task-template-card ${step.active === false ? 'disabled' : ''}`}>
        <div className="task-template-top">
          <div>
            <span className="task-type-pill">{workflowName(step.workflow_id)}</span>
            <h4>{step.name}</h4>
          </div>
          <strong>P{step.priority || 70}</strong>
        </div>

        <div className="task-template-meta">
          <div>
            <span>Offset</span>
            <b>{step.offset_minutes || 0} min</b>
          </div>
          <div>
            <span>Duration</span>
            <b>{step.duration_minutes || 10} min</b>
          </div>
          <div>
            <span>Condition</span>
            <b>{step.condition || 'None'}</b>
          </div>
        </div>

        <div className="task-template-actions">
          <button onClick={() => toggleActive('workflow_steps', step.id, step.active)}>{step.active === false ? 'Enable' : 'Disable'}</button>
          <button onClick={() => setStepForm({
            id: step.id,
            workflow_id: step.workflow_id,
            name: step.name,
            task_type: step.task_type || 'manual',
            offset_minutes: String(step.offset_minutes || 0),
            duration_minutes: String(step.duration_minutes || 10),
            priority: String(step.priority || 70),
            primary_staff: step.primary_staff || '',
            fallback_staff: step.fallback_staff || [],
            condition: step.condition || '',
            sort_order: String(step.sort_order || 0),
            active: step.active !== false,
          })}>Edit</button>
          <button className="danger" onClick={() => remove('workflow_steps', step.id)}>Delete</button>
        </div>
      </article>
    )
  }

  return (
    <section className="rules-page task-manager-page">
      <div className="task-manager-hero">
        <div>
          <span className="ops-kicker">Task system v2</span>
          <h3>Daily, recurring & workflow tasks</h3>
          <p>Teach the planner how your stable really works. Daily routines, periodic checks and workflows stay separated.</p>
        </div>

        <div className="task-manager-actions">
          {tab === 'daily' && <button type="button" className="ops-add-task-btn" onClick={() => setDailyForm(emptyDaily())}>+ Daily task</button>}
          {tab === 'recurring' && <button type="button" className="ops-add-task-btn" onClick={() => setRecurringForm(emptyRecurring())}>+ Recurring task</button>}
          {tab === 'workflows' && <button type="button" className="ops-add-task-btn" onClick={() => setWorkflowForm(emptyWorkflow())}>+ Workflow</button>}
          {tab === 'steps' && <button type="button" className="ops-add-task-btn" onClick={() => setStepForm(emptyStep(workflows[0]?.id || ''))}>+ Step</button>}
        </div>
      </div>

      <div className="task-manager-tabs">
        <button className={tab === 'daily' ? 'active' : ''} onClick={() => setTab('daily')}>Daily tasks</button>
        <button className={tab === 'recurring' ? 'active' : ''} onClick={() => setTab('recurring')}>Recurring tasks</button>
        <button className={tab === 'workflows' ? 'active' : ''} onClick={() => setTab('workflows')}>Workflows</button>
        <button className={tab === 'steps' ? 'active' : ''} onClick={() => setTab('steps')}>Workflow steps</button>
      </div>

      <div className="task-manager-toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
      </div>

      <div className="task-template-grid">
        {tab === 'daily' && filteredDaily.map((task) => <DailyCard key={task.id} task={task} />)}
        {tab === 'recurring' && filteredRecurring.map((task) => <RecurringCard key={task.id} task={task} />)}
        {tab === 'workflows' && filteredWorkflows.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} />)}
        {tab === 'steps' && workflowSteps
          .filter((step) => !q || step.name.toLowerCase().includes(q) || workflowName(step.workflow_id).toLowerCase().includes(q))
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
          .map((step) => <StepCard key={step.id} step={step} />)}
      </div>

      {dailyForm && (
        <TaskModal title={dailyForm.id ? 'Edit daily task' : 'New daily task'} onClose={() => setDailyForm(null)} onSave={saveDaily}>
          <BasicTaskFields
            form={dailyForm}
            setForm={setDailyForm}
            staff={activeStaff}
            toggleFallback={(name) => toggleFallback(dailyForm, setDailyForm, name)}
            includeSort
          />
        </TaskModal>
      )}

      {recurringForm && (
        <TaskModal title={recurringForm.id ? 'Edit recurring task' : 'New recurring task'} onClose={() => setRecurringForm(null)} onSave={saveRecurring}>
          <BasicTaskFields
            form={recurringForm}
            setForm={setRecurringForm}
            staff={activeStaff}
            toggleFallback={(name) => toggleFallback(recurringForm, setRecurringForm, name)}
          />

          <div className="ops-form-row">
            <div className="ops-form-group">
              <label>Frequency</label>
              <select value={recurringForm.frequency_type} onChange={(e) => setRecurringForm({ ...recurringForm, frequency_type: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="every_x_days">Every X days</option>
              </select>
            </div>

            <div className="ops-form-group">
              <label>Interval days</label>
              <input type="number" value={recurringForm.interval_days} onChange={(e) => setRecurringForm({ ...recurringForm, interval_days: e.target.value })} disabled={recurringForm.frequency_type !== 'every_x_days'} />
            </div>
          </div>

          <div className="ops-form-group">
            <label>Next due date</label>
            <input type="date" value={recurringForm.next_due_date} onChange={(e) => setRecurringForm({ ...recurringForm, next_due_date: e.target.value })} />
          </div>
        </TaskModal>
      )}

      {workflowForm && (
        <TaskModal title={workflowForm.id ? 'Edit workflow' : 'New workflow'} onClose={() => setWorkflowForm(null)} onSave={saveWorkflow}>
          <div className="ops-form-group">
            <label>Name</label>
            <input value={workflowForm.name} onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })} placeholder="Ride horse" />
          </div>

          <div className="ops-form-group">
            <label>Workflow type</label>
            <select value={workflowForm.workflow_type} onChange={(e) => setWorkflowForm({ ...workflowForm, workflow_type: e.target.value })}>
              {workflowTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <Toggle label="Active workflow" checked={workflowForm.active} onChange={(checked) => setWorkflowForm({ ...workflowForm, active: checked })} />

          <div className="ops-form-group">
            <label>Notes</label>
            <textarea value={workflowForm.notes} onChange={(e) => setWorkflowForm({ ...workflowForm, notes: e.target.value })} />
          </div>
        </TaskModal>
      )}

      {stepForm && (
        <TaskModal title={stepForm.id ? 'Edit workflow step' : 'New workflow step'} onClose={() => setStepForm(null)} onSave={saveStep}>
          <div className="ops-form-group">
            <label>Workflow</label>
            <select value={stepForm.workflow_id} onChange={(e) => setStepForm({ ...stepForm, workflow_id: e.target.value })}>
              <option value="">Choose workflow</option>
              {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
            </select>
          </div>

          <div className="ops-form-group">
            <label>Step name</label>
            <input value={stepForm.name} onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })} placeholder="Groom horse" />
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group">
              <label>Task type</label>
              <select value={stepForm.task_type} onChange={(e) => setStepForm({ ...stepForm, task_type: e.target.value })}>
                {taskTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>

            <div className="ops-form-group">
              <label>Priority</label>
              <input type="number" value={stepForm.priority} onChange={(e) => setStepForm({ ...stepForm, priority: e.target.value })} />
            </div>
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group">
              <label>Offset minutes</label>
              <input type="number" value={stepForm.offset_minutes} onChange={(e) => setStepForm({ ...stepForm, offset_minutes: e.target.value })} />
            </div>

            <div className="ops-form-group">
              <label>Duration minutes</label>
              <input type="number" value={stepForm.duration_minutes} onChange={(e) => setStepForm({ ...stepForm, duration_minutes: e.target.value })} />
            </div>
          </div>

          <div className="ops-form-row">
            <div className="ops-form-group">
              <label>Condition</label>
              <select value={stepForm.condition} onChange={(e) => setStepForm({ ...stepForm, condition: e.target.value })}>
                {conditions.map((condition) => <option key={condition} value={condition}>{condition || 'None'}</option>)}
              </select>
            </div>

            <div className="ops-form-group">
              <label>Sort order</label>
              <input type="number" value={stepForm.sort_order} onChange={(e) => setStepForm({ ...stepForm, sort_order: e.target.value })} />
            </div>
          </div>

          <StaffChoice
            staff={activeStaff}
            primary={stepForm.primary_staff}
            setPrimary={(primary) => setStepForm({ ...stepForm, primary_staff: primary })}
            fallback={stepForm.fallback_staff}
            toggleFallback={(name) => toggleFallback(stepForm, setStepForm, name)}
          />

          <Toggle label="Active step" checked={stepForm.active} onChange={(checked) => setStepForm({ ...stepForm, active: checked })} />
        </TaskModal>
      )}
    </section>
  )
}

function TaskModal({
  title,
  children,
  onClose,
  onSave,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="ops-modal-backdrop" onClick={onClose}>
      <div className="ops-modal task-template-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ops-modal-top">
          <div>
            <span className="ops-kicker">Task setup</span>
            <h2>{title}</h2>
          </div>

          <button type="button" className="ops-close" onClick={onClose}>×</button>
        </div>

        {children}

        <div className="ops-modal-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-save-btn" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function BasicTaskFields<T extends DailyForm | RecurringForm>({
  form,
  setForm,
  staff,
  toggleFallback,
  includeSort = false,
}: {
  form: T
  setForm: (next: T) => void
  staff: Staff[]
  toggleFallback: (name: string) => void
  includeSort?: boolean
}) {
  return (
    <>
      <div className="ops-form-group">
        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>

      <div className="ops-form-row">
        <div className="ops-form-group">
          <label>Task type</label>
          <select value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
            {taskTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div className="ops-form-group">
          <label>Priority</label>
          <input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
        </div>
      </div>

      <Toggle label="Timing is important" checked={form.timing_required} onChange={(checked) => setForm({ ...form, timing_required: checked })} />

      <div className="ops-form-row">
        <div className="ops-form-group">
          <label>Start time</label>
          <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} disabled={!form.timing_required} />
        </div>

        <div className="ops-form-group">
          <label>Duration minutes</label>
          <input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
        </div>
      </div>

      {includeSort && (
        <div className="ops-form-group">
          <label>Sort order</label>
          <input type="number" value={(form as DailyForm).sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value } as T)} />
        </div>
      )}

      <StaffChoice
        staff={staff}
        primary={form.primary_staff}
        setPrimary={(primary) => setForm({ ...form, primary_staff: primary })}
        fallback={form.fallback_staff}
        toggleFallback={toggleFallback}
      />

      <Toggle label="Active task" checked={form.active} onChange={(checked) => setForm({ ...form, active: checked })} />

      <div className="ops-form-group">
        <label>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>
    </>
  )
}

function StaffChoice({
  staff,
  primary,
  setPrimary,
  fallback,
  toggleFallback,
}: {
  staff: Staff[]
  primary: string
  setPrimary: (name: string) => void
  fallback: string[]
  toggleFallback: (name: string) => void
}) {
  return (
    <>
      <div className="ops-form-group">
        <label>First choice person</label>
        <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
          <option value="">Auto assign</option>
          {staff.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}
        </select>
      </div>

      <div className="ops-form-group">
        <label>Fallback persons</label>
        <div className="fallback-grid">
          {staff.map((person) => (
            <button
              key={person.id}
              type="button"
              className={fallback.includes(person.name) ? 'active' : ''}
              onClick={() => toggleFallback(person.name)}
            >
              {person.name}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="task-timing-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <strong>{label}</strong>
        <span>{checked ? 'Enabled' : 'Disabled'}</span>
      </div>
    </label>
  )
}
