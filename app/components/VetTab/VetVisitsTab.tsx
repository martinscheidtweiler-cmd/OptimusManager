'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import styles from './VetVisitsTab.module.css'

type Horse = {
  id: string
  name: string
  active: boolean | null
  horse_type: string | null
  birth_date: string | null
}

type VetVisit = {
  id: string
  visit_date: string
  status: 'planned' | 'done' | 'cancelled'
  title: string | null
  vet_notes: string | null
  followup_on: string | null
  created_at: string
}

type VetVisitItem = {
  id: string
  visit_id: string | null
  horse_id: string
  complaint_date: string
  complaint: string
  vet_comment: string | null
  required_treatment: string | null
  followup_on: string | null
  action_required: boolean
  is_done: boolean
  created_at: string
}

type Props = {
  onBack: () => void
}

function todayISO() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function addDaysISO(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function toISO(date: Date) {
  const copy = new Date(date)
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset())
  return copy.toISOString().slice(0, 10)
}

function monthTitle(date: Date) {
  return date.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('nl-BE')
}

function daysSince(value: string | null) {
  if (!value) return null

  const start = new Date(value)
  const today = new Date()

  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)

  return Math.floor((today.getTime() - start.getTime()) / 86400000)
}

export default function VetVisitsTab({ onBack }: Props) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [visits, setVisits] = useState<VetVisit[]>([])
  const [items, setItems] = useState<VetVisitItem[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedHorseId, setSelectedHorseId] = useState('')
  const [complaintDate, setComplaintDate] = useState(todayISO())
  const [complaint, setComplaint] = useState('')

  const [monthDate, setMonthDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [visitTitle, setVisitTitle] = useState('Vet visit')

  const [historySearch, setHistorySearch] = useState('')
  const [historyDate, setHistoryDate] = useState('')

  const loadData = async () => {
    setLoading(true)

    try {
      const [
        { data: horsesData, error: horsesError },
        { data: visitsData, error: visitsError },
        { data: itemsData, error: itemsError },
      ] = await Promise.all([
        supabase
          .from('horses')
          .select('id, name, active, horse_type, birth_date')
          .eq('active', true)
          .in('horse_type', ['Sport horse', 'Young horse', 'Foal'])
          .order('name', { ascending: true }),

        supabase
          .from('vet_visits')
          .select('id, visit_date, status, title, vet_notes, followup_on, created_at')
          .order('visit_date', { ascending: true }),

        supabase
          .from('vet_visit_items')
          .select(
            'id, visit_id, horse_id, complaint_date, complaint, vet_comment, required_treatment, followup_on, action_required, is_done, created_at'
          )
          .order('created_at', { ascending: false }),
      ])

      if (horsesError) throw horsesError
      if (visitsError) throw visitsError
      if (itemsError) throw itemsError

      setHorses((horsesData || []) as Horse[])
      setVisits((visitsData || []) as VetVisit[])
      setItems((itemsData || []) as VetVisitItem[])
    } catch (err) {
      console.error('Error loading vet visits:', err)
      alert('Laden mislukt.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const horseById = useMemo(() => {
    return new Map(horses.map((horse) => [horse.id, horse]))
  }, [horses])

  const selectedVisit = useMemo(() => {
    return visits.find((visit) => visit.visit_date === selectedDate) || null
  }, [visits, selectedDate])

  const openItems = useMemo(() => {
    const followupTriggerDate = addDaysISO(3)

    return items.filter((item) => {
      if (!item.is_done) return true
      if (item.followup_on && item.followup_on <= followupTriggerDate) return true
      return false
    })
  }, [items])

  const selectedDayItems = useMemo(() => {
    if (!selectedVisit) return []
    return items.filter((item) => item.visit_id === selectedVisit.id)
  }, [items, selectedVisit])

  const filteredHistory = useMemo(() => {
    const search = historySearch.trim().toLowerCase()

    return items
      .filter((item) => item.is_done)
      .filter((item) => {
        const horse = horseById.get(item.horse_id)
        const visit = item.visit_id ? visits.find((v) => v.id === item.visit_id) : null

        const haystack = [
          horse?.name,
          item.complaint,
          item.vet_comment,
          item.required_treatment,
          item.followup_on,
          visit?.title,
          visit?.visit_date,
          item.complaint_date,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        const matchesSearch = !search || haystack.includes(search)
        const matchesDate =
          !historyDate ||
          visit?.visit_date === historyDate ||
          item.complaint_date === historyDate ||
          item.followup_on === historyDate

        return matchesSearch && matchesDate
      })
  }, [items, horseById, visits, historySearch, historyDate])

  const calendarDays = useMemo(() => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()

    const first = new Date(year, month, 1)
    const start = new Date(first)
    const day = first.getDay() === 0 ? 6 : first.getDay() - 1

    start.setDate(first.getDate() - day)

    return Array.from({ length: 42 }).map((_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return date
    })
  }, [monthDate])

  const visitsByDate = useMemo(() => {
    const map = new Map<string, VetVisit[]>()

    visits.forEach((visit) => {
      if (!map.has(visit.visit_date)) map.set(visit.visit_date, [])
      map.get(visit.visit_date)?.push(visit)
    })

    return map
  }, [visits])

  const selectCalendarDate = (date: string) => {
    setSelectedDate(date)
    setCalendarOpen(true)

    const visit = visits.find((v) => v.visit_date === date)
    setVisitTitle(visit?.title || 'Vet visit')
  }

  const addComplaint = async () => {
    if (!selectedHorseId) {
      alert('Selecteer eerst een paard.')
      return
    }

    if (!complaint.trim()) {
      alert('Schrijf eerst een klacht/probleem.')
      return
    }

    setSaving(true)

    try {
      const { error } = await supabase.from('vet_visit_items').insert({
        horse_id: selectedHorseId,
        complaint_date: complaintDate || todayISO(),
        complaint: complaint.trim(),
        visit_id: null,
        vet_comment: null,
        required_treatment: null,
        followup_on: null,
        action_required: false,
        is_done: false,
      })

      if (error) throw error

      setComplaint('')
      setComplaintDate(todayISO())
      await loadData()
    } catch (err) {
      console.error('Error adding complaint:', err)
      alert('Opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const bookVisit = async () => {
    if (!selectedDate) return

    setSaving(true)

    try {
      const { error } = await supabase.from('vet_visits').insert({
        visit_date: selectedDate,
        title: visitTitle.trim() || 'Vet visit',
        status: 'planned',
      })

      if (error) throw error

      await loadData()
    } catch (err) {
      console.error('Error booking visit:', err)
      alert('Afspraak maken mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const updateComplaint = async (
    item: VetVisitItem,
    values: {
      vetComment: string
      requiredTreatment: string
      followupOn: string
    }
  ) => {
    setSaving(true)

    const autoDone = values.vetComment.trim().length > 0
    const autoActionRequired = values.requiredTreatment.trim().length > 0

    try {
      const { error } = await supabase
        .from('vet_visit_items')
        .update({
          vet_comment: values.vetComment.trim() || null,
          required_treatment: values.requiredTreatment.trim() || null,
          followup_on: values.followupOn || null,
          action_required: autoActionRequired,
          is_done: autoDone,
        })
        .eq('id', item.id)

      if (error) throw error

      await loadData()
    } catch (err) {
      console.error('Error updating complaint:', err)
      alert('Opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const deleteComplaint = async (id: string) => {
    if (!confirm('Deze complaint verwijderen?')) return

    const { error } = await supabase.from('vet_visit_items').delete().eq('id', id)

    if (error) {
      console.error('Error deleting complaint:', error)
      alert('Verwijderen mislukt.')
      return
    }

    await loadData()
  }

  const selectedDateIsPast = selectedDate < todayISO()

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button type="button" className={styles.secondaryBtn} onClick={onBack}>
          ← Back
        </button>

        <div>
          <span className={styles.kicker}>Medical planning</span>
          <h2>Vet Visits</h2>
          <p>Complaints, vet appointments and full medical visit history.</p>
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>Open complaints</span>
              <h3>Horse complaints</h3>
            </div>

            <strong>{openItems.length}</strong>
          </div>

          <div className={styles.formGrid}>
            <label>
              Horse
              <select value={selectedHorseId} onChange={(e) => setSelectedHorseId(e.target.value)}>
                <option value="">Select horse</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Complaint since
              <input
                type="date"
                value={complaintDate}
                onChange={(e) => setComplaintDate(e.target.value)}
              />
            </label>

            <label className={styles.full}>
              Complaint / problem
              <textarea
                placeholder="Example: lame for 5 days, left hind knee, stiff back..."
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
              />
            </label>
          </div>

          <button type="button" className={styles.primaryBtn} onClick={addComplaint} disabled={saving}>
            {saving ? 'Saving...' : 'Add complaint'}
          </button>

          <div className={styles.itemList}>
            {openItems.length === 0 && <div className={styles.empty}>No open complaints.</div>}

            {openItems.map((item) => (
              <ComplaintEditor
                key={item.id}
                item={item}
                horseName={horseById.get(item.horse_id)?.name || 'Unknown horse'}
                onSave={updateComplaint}
                onDelete={deleteComplaint}
              />
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.kicker}>Calendar</span>
              <h3>{monthTitle(monthDate)}</h3>
            </div>

            <div className={styles.monthButtons}>
              <button
                type="button"
                onClick={() =>
                  setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))
                }
              >
                ←
              </button>

              <button
                type="button"
                onClick={() =>
                  setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))
                }
              >
                →
              </button>
            </div>
          </div>

          <div className={styles.calendar}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <strong key={day}>{day}</strong>
            ))}

            {calendarDays.map((day) => {
              const iso = toISO(day)
              const dayVisits = visitsByDate.get(iso) || []
              const muted = day.getMonth() !== monthDate.getMonth()
              const selected = selectedDate === iso

              return (
                <button
                  key={iso}
                  type="button"
                  className={`${styles.day} ${muted ? styles.dayMuted : ''} ${
                    dayVisits.length ? styles.dayHasEvent : ''
                  } ${selected ? styles.daySelected : ''}`}
                  onClick={() => selectCalendarDate(iso)}
                >
                  <span>{day.getDate()}</span>

                  {dayVisits.slice(0, 2).map((visit) => (
                    <small key={visit.id}>{visit.title || 'Vet visit'}</small>
                  ))}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <span className={styles.kicker}>History</span>
            <h3>Vet history</h3>
          </div>

          <strong>{filteredHistory.length}</strong>
        </div>

        <div className={styles.formGrid}>
          <label>
            Search horse / note
            <input
              placeholder="Search horse, complaint, treatment..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
            />
          </label>

          <label>
            Date
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
            />
          </label>
        </div>

        <div className={styles.historyList}>
          {filteredHistory.length === 0 && <div className={styles.empty}>No history found.</div>}

          {filteredHistory.map((item) => {
            const horse = horseById.get(item.horse_id)
            const visit = item.visit_id ? visits.find((v) => v.id === item.visit_id) : null
            const since = daysSince(item.complaint_date)

            return (
              <article key={item.id} className={styles.historyRow}>
                <div>
                  <strong>{horse?.name || 'Unknown horse'}</strong>
                  <span>{formatDate(visit?.visit_date || item.created_at)}</span>
                </div>

                <p>{item.complaint}</p>

                {item.vet_comment && (
                  <p>
                    <b>Vet said:</b> {item.vet_comment}
                  </p>
                )}

                {item.required_treatment && (
                  <p>
                    <b>Treatment:</b> {item.required_treatment}
                  </p>
                )}

                {item.followup_on && (
                  <p>
                    <b>Follow-up:</b> {formatDate(item.followup_on)}
                  </p>
                )}

                <small>
                  Complaint since {formatDate(item.complaint_date)}
                  {since !== null && since > 0 ? ` · ${since} day(s)` : ''}
                  {item.action_required ? ' · Action required' : ''}
                </small>

                <div className={styles.dropActions}>
                  <button type="button" onClick={() => deleteComplaint(item.id)}>
                    Delete from history
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {calendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setCalendarOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.cardHead}>
              <div>
                <span className={styles.kicker}>{formatDate(selectedDate)}</span>
                <h3>
                  {selectedVisit
                    ? selectedDateIsPast
                      ? 'Vet visit history'
                      : 'Appointment made'
                    : 'Book a visit'}
                </h3>
              </div>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setCalendarOpen(false)}
              >
                Close
              </button>
            </div>

            {!selectedVisit ? (
              <>
                <label className={styles.bigLabel}>
                  Appointment title
                  <input value={visitTitle} onChange={(e) => setVisitTitle(e.target.value)} />
                </label>

                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={bookVisit}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Appointment made'}
                </button>
              </>
            ) : (
              <div className={styles.historyList}>
                <p className={styles.empty}>
                  {selectedVisit.title || 'Vet visit'} · {selectedVisit.status}
                </p>

                {selectedDayItems.length === 0 && (
                  <div className={styles.empty}>No horse history linked to this day.</div>
                )}

                {selectedDayItems.map((item) => {
                  const since = daysSince(item.complaint_date)

                  return (
                    <article key={item.id} className={styles.historyRow}>
                      <div>
                        <strong>{horseById.get(item.horse_id)?.name || 'Unknown horse'}</strong>
                        <span>{formatDate(selectedVisit.visit_date)}</span>
                      </div>

                      <p>{item.complaint}</p>

                      {item.vet_comment && (
                        <p>
                          <b>Vet said:</b> {item.vet_comment}
                        </p>
                      )}

                      {item.required_treatment && (
                        <p>
                          <b>Treatment:</b> {item.required_treatment}
                        </p>
                      )}

                      {item.followup_on && (
                        <p>
                          <b>Follow-up:</b> {formatDate(item.followup_on)}
                        </p>
                      )}

                      <small>
                        Complaint since {formatDate(item.complaint_date)}
                        {since !== null && since > 0 ? ` · ${since} day(s)` : ''}
                        {item.is_done ? ' · Done' : ' · Open'}
                        {item.action_required ? ' · Action required' : ''}
                      </small>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ComplaintEditor({
  item,
  horseName,
  onSave,
  onDelete,
}: {
  item: VetVisitItem
  horseName: string
  onSave: (
    item: VetVisitItem,
    values: {
      vetComment: string
      requiredTreatment: string
      followupOn: string
    }
  ) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [vetComment, setVetComment] = useState(item.vet_comment || '')
  const [requiredTreatment, setRequiredTreatment] = useState(item.required_treatment || '')
  const [followupOn, setFollowupOn] = useState(item.followup_on || '')

  const since = daysSince(item.complaint_date)
  const autoDone = vetComment.trim().length > 0
  const autoActionRequired = requiredTreatment.trim().length > 0

  return (
    <article className={styles.complaintDrop}>
      <button
        type="button"
        className={styles.complaintDropHead}
        onClick={() => setOpen((value) => !value)}
      >
        <div>
          <strong>{horseName}</strong>
          <span>{item.complaint}</span>

          <small>
            Since {formatDate(item.complaint_date)}
            {since !== null && since > 0 ? ` · ${since} day(s)` : ''}
            {item.followup_on ? ` · Follow-up ${formatDate(item.followup_on)}` : ''}
          </small>
        </div>

        <b>{open ? '−' : '+'}</b>
      </button>

      {open && (
        <div className={styles.complaintDropBody}>
          <label>
            What did the vet say?
            <textarea
              placeholder="Vet comment..."
              value={vetComment}
              onChange={(e) => setVetComment(e.target.value)}
            />
          </label>

          <label>
            Required treatment
            <textarea
              placeholder="Treatment needed..."
              value={requiredTreatment}
              onChange={(e) => setRequiredTreatment(e.target.value)}
            />
          </label>

          <label>
            Follow-up date
            <input
              type="date"
              value={followupOn}
              onChange={(e) => setFollowupOn(e.target.value)}
            />
          </label>

          <div className={styles.statusPills}>
            {autoDone && <span className={styles.donePill}>Done</span>}
            {autoActionRequired && <span className={styles.actionPill}>Action required</span>}
            {followupOn && <span>Follow-up {formatDate(followupOn)}</span>}
          </div>

          <div className={styles.dropActions}>
            <button
              type="button"
              onClick={() =>
                onSave(item, {
                  vetComment,
                  requiredTreatment,
                  followupOn,
                })
              }
            >
              Save
            </button>

            <button type="button" onClick={() => onDelete(item.id)}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  )
}