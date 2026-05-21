'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import type { Staff } from './OperationsTab'

type RidingTaskTemplate = {
  id: string
  name: string
  task_type: string
  offset_minutes: number
  duration_minutes: number
  primary_staff: string | null
  fallback_staff: string[] | null
  priority: number
  active: boolean
  sort_order: number
}

type Props = {
  templates: RidingTaskTemplate[]
  staff: Staff[]
  onRefresh: () => void | Promise<void>
}

const taskTypes = ['groom', 'ride', 'manual', 'medical']

export default function RidingWorkflowView({ templates, staff, onRefresh }: Props) {
  const [editing, setEditing] = useState<RidingTaskTemplate | null>(null)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [taskType, setTaskType] = useState('groom')
  const [offsetMinutes, setOffsetMinutes] = useState('-15')
  const [durationMinutes, setDurationMinutes] = useState('10')
  const [primaryStaff, setPrimaryStaff] = useState('')
  const [fallbackStaff, setFallbackStaff] = useState<string[]>([])
  const [priority, setPriority] = useState('70')
  const [sortOrder, setSortOrder] = useState('0')
  const [active, setActive] = useState(true)

  const activeStaff = staff.filter((person) => person.active !== false)

  function resetForm() {
    setEditing(null)
    setName('')
    setTaskType('groom')
    setOffsetMinutes('-15')
    setDurationMinutes('10')
    setPrimaryStaff('')
    setFallbackStaff([])
    setPriority('70')
    setSortOrder('0')
    setActive(true)
  }

  function openCreate() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(template: RidingTaskTemplate) {
    setEditing(template)
    setName(template.name)
    setTaskType(template.task_type || 'groom')
    setOffsetMinutes(String(template.offset_minutes ?? 0))
    setDurationMinutes(String(template.duration_minutes ?? 10))
    setPrimaryStaff(template.primary_staff || '')
    setFallbackStaff(template.fallback_staff || [])
    setPriority(String(template.priority || 70))
    setSortOrder(String(template.sort_order || 0))
    setActive(template.active !== false)
    setShowForm(true)
  }

  function toggleFallback(personName: string) {
    setFallbackStaff((prev) =>
      prev.includes(personName)
        ? prev.filter((item) => item !== personName)
        : [...prev, personName],
    )
  }

  async function saveTemplate() {
    if (!name.trim()) {
      alert('Name is required')
      return
    }

    const payload = {
      name: name.trim(),
      task_type: taskType,
      offset_minutes: Number(offsetMinutes || 0),
      duration_minutes: Number(durationMinutes || 10),
      primary_staff: primaryStaff || null,
      fallback_staff: fallbackStaff,
      priority: Number(priority || 70),
      sort_order: Number(sortOrder || 0),
      active,
    }

    const query = editing
      ? supabase.from('riding_task_templates').update(payload).eq('id', editing.id)
      : supabase.from('riding_task_templates').insert(payload)

    const { error } = await query

    if (error) {
      alert(error.message)
      return
    }

    setShowForm(false)
    resetForm()
    await onRefresh()
  }

  async function deleteTemplate(template: RidingTaskTemplate) {
    if (!confirm(`Delete "${template.name}"?`)) return

    const { error } = await supabase.from('riding_task_templates').delete().eq('id', template.id)

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  async function toggleActive(template: RidingTaskTemplate) {
    const { error } = await supabase
      .from('riding_task_templates')
      .update({ active: template.active === false })
      .eq('id', template.id)

    if (error) {
      alert(error.message)
      return
    }

    await onRefresh()
  }

  return (
    <section className="task-manager-page">
      <div className="task-manager-hero">
        <div>
          <span className="ops-kicker">Riding workflow</span>
          <h3>Tasks around each ride</h3>
          <p>
            Control what happens before and after a horse is ridden. Terry can use staff prep,
            other riders can do their own prep if planned that way.
          </p>
        </div>

        <button type="button" className="ops-add-task-btn" onClick={openCreate}>
          + Add workflow step
        </button>
      </div>

      <div className="task-template-grid">
        {templates.length === 0 ? (
          <div className="ops-empty-task">No riding workflow steps yet.</div>
        ) : (
          templates
            .slice()
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
            .map((template) => (
              <article
                key={template.id}
                className={`task-template-card ${template.active ? '' : 'disabled'}`}
              >
                <div className="task-template-top">
                  <div>
                    <span className="task-type-pill">{template.task_type}</span>
                    <h4>{template.name}</h4>
                  </div>

                  <strong>P{template.priority}</strong>
                </div>

                <div className="task-template-meta">
                  <div>
                    <span>Offset</span>
                    <b>
                      {template.offset_minutes > 0 ? '+' : ''}
                      {template.offset_minutes} min
                    </b>
                  </div>

                  <div>
                    <span>Duration</span>
                    <b>{template.duration_minutes} min</b>
                  </div>

                  <div>
                    <span>First choice</span>
                    <b>{template.primary_staff || 'Auto / rider'}</b>
                  </div>
                </div>

                <p>
                  Fallback:{' '}
                  {template.fallback_staff?.length ? template.fallback_staff.join(', ') : 'None'} ·
                  Sort: {template.sort_order}
                </p>

                <div className="task-template-actions">
                  <button type="button" onClick={() => toggleActive(template)}>
                    {template.active === false ? 'Enable' : 'Disable'}
                  </button>

                  <button type="button" onClick={() => openEdit(template)}>
                    Edit
                  </button>

                  <button type="button" className="danger" onClick={() => deleteTemplate(template)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
        )}
      </div>

      {showForm && (
        <div className="ops-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="ops-modal task-template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ops-modal-top">
              <div>
                <span className="ops-kicker">Workflow step</span>
                <h2>{editing ? 'Edit step' : 'New step'}</h2>
              </div>

              <button type="button" className="ops-close" onClick={() => setShowForm(false)}>
                ×
              </button>
            </div>

            <div className="ops-form-group">
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Get horse / Groom / Tack up / Ride / Aftercare"
              />
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Type</label>
                <select value={taskType} onChange={(e) => setTaskType(e.target.value)}>
                  {taskTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ops-form-group">
                <label>Priority</label>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Offset minutes</label>
                <input
                  type="number"
                  value={offsetMinutes}
                  onChange={(e) => setOffsetMinutes(e.target.value)}
                />
                <small>
                  Negative = before ride. 0 = ride start. Positive = after ride start.
                </small>
              </div>

              <div className="ops-form-group">
                <label>Duration minutes</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                />
              </div>
            </div>

            <div className="ops-form-group">
              <label>First choice person</label>
              <select value={primaryStaff} onChange={(e) => setPrimaryStaff(e.target.value)}>
                <option value="">Auto / rider</option>
                {activeStaff.map((person) => (
                  <option key={person.id} value={person.name}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="ops-form-group">
              <label>Fallback persons</label>
              <div className="fallback-grid">
                {activeStaff.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    className={fallbackStaff.includes(person.name) ? 'active' : ''}
                    onClick={() => toggleFallback(person.name)}
                  >
                    {person.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="ops-form-row">
              <div className="ops-form-group">
                <label>Sort order</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </div>

              <label className="task-timing-toggle">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <div>
                  <strong>Active</strong>
                  <span>Use this step when generating ride tasks.</span>
                </div>
              </label>
            </div>

            <div className="ops-modal-actions">
              <button type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>

              <button type="button" className="ops-save-btn" onClick={saveTemplate}>
                Save step
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}