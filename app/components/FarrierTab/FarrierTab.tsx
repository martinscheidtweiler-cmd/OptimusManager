'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './FarrierTab.css'

type FarrierName = 'Maarten' | 'Kamiel' | 'Johan' | 'Wim'
type Status = 'urgent' | 'overdue' | 'soon' | 'ok'

type HorseRow = {
  id: string
  name: string | null
  active: boolean | null
  farrier_name: string | null
  last_farrier_date: string | null
  farrier_interval_days: number | null
  farrier_notes: string | null
  farrier_postponed_until: string | null
  lost_shoe_alert: boolean | null
  lost_shoe_reported_at: string | null
}

type HorseFarrierItem = {
  id: string
  horseName: string
  farrier: FarrierName | ''
  lastVisit: string | null
  intervalDays: number
  notes: string
  postponedUntil: string | null
  lostShoeAlert: boolean
  lostShoeReportedAt: string | null
}

type EnrichedHorse = HorseFarrierItem & {
  safeLastVisit: string
  baseNextVisit: Date
  effectiveNextVisit: Date
  status: Status
}

const FARRIERS: FarrierName[] = ['Maarten', 'Kamiel', 'Johan', 'Wim']

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return date
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-BE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function diffInDays(from: Date, to: Date) {
  const msPerDay = 1000 * 60 * 60 * 24
  const utcFrom = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const utcTo = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.floor((utcTo - utcFrom) / msPerDay)
}

function todayString() {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nowIsoString() {
  return new Date().toISOString()
}

function getStatusLabel(status: Status) {
  if (status === 'urgent') return 'Urgent'
  if (status === 'overdue') return 'Overdue'
  if (status === 'soon') return 'Soon'
  return 'OK'
}

export default function FarrierTab() {
  const [horses, setHorses] = useState<HorseFarrierItem[]>([])
  const [selectedFarrier, setSelectedFarrier] = useState<FarrierName | 'All'>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lostShoeOpen, setLostShoeOpen] = useState(false)
  const [lostShoeHorseId, setLostShoeHorseId] = useState('')

  useEffect(() => {
    fetchHorses()
  }, [])

  async function fetchHorses() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('horses')
      .select(`
        id,
        name,
        active,
        farrier_name,
        last_farrier_date,
        farrier_interval_days,
        farrier_notes,
        farrier_postponed_until,
        lost_shoe_alert,
        lost_shoe_reported_at
      `)
      .eq('active', true)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error loading farrier horses:', error)
      setError(error.message)
      setLoading(false)
      return
    }

    const mapped: HorseFarrierItem[] = ((data as HorseRow[]) || []).map((horse) => ({
      id: String(horse.id),
      horseName: horse.name || 'Unnamed horse',
      farrier: FARRIERS.includes(horse.farrier_name as FarrierName)
        ? (horse.farrier_name as FarrierName)
        : '',
      lastVisit: horse.last_farrier_date,
      intervalDays: horse.farrier_interval_days || 42,
      notes: horse.farrier_notes || '',
      postponedUntil: horse.farrier_postponed_until,
      lostShoeAlert: !!horse.lost_shoe_alert,
      lostShoeReportedAt: horse.lost_shoe_reported_at,
    }))

    setHorses(mapped)
    setLoading(false)
  }

  const enriched = useMemo<EnrichedHorse[]>(() => {
    return horses.map((horse) => {
      const safeLastVisit = horse.lastVisit || todayString()
      const baseNextVisit = addDays(safeLastVisit, horse.intervalDays)

      let effectiveNextVisit = baseNextVisit
      if (horse.postponedUntil) {
        const postponedDate = new Date(horse.postponedUntil)
        if (postponedDate.getTime() > baseNextVisit.getTime()) {
          effectiveNextVisit = postponedDate
        }
      }

      let status: Status = 'ok'
      if (horse.lostShoeAlert) {
        status = 'urgent'
      } else {
        const daysLeft = diffInDays(new Date(), effectiveNextVisit)
        if (daysLeft < 0) status = 'overdue'
        else if (daysLeft <= 14) status = 'soon'
        else status = 'ok'
      }

      return {
        ...horse,
        safeLastVisit,
        baseNextVisit,
        effectiveNextVisit,
        status,
      }
    })
  }, [horses])

  const urgentItems = useMemo(() => {
    return enriched
      .filter((horse) => horse.lostShoeAlert)
      .sort((a, b) => {
        const aTime = a.lostShoeReportedAt ? new Date(a.lostShoeReportedAt).getTime() : 0
        const bTime = b.lostShoeReportedAt ? new Date(b.lostShoeReportedAt).getTime() : 0
        return bTime - aTime
      })
  }, [enriched])

  const filtered = useMemo(() => {
    return enriched
      .filter((horse) => {
        const matchesFarrier =
          selectedFarrier === 'All' ? true : horse.farrier === selectedFarrier

        const matchesSearch = horse.horseName
          .toLowerCase()
          .includes(search.toLowerCase())

        return matchesFarrier && matchesSearch
      })
      .sort((a, b) => {
        const order = { urgent: 0, overdue: 1, soon: 2, ok: 3 }
        const statusDiff = order[a.status] - order[b.status]
        if (statusDiff !== 0) return statusDiff
        return a.effectiveNextVisit.getTime() - b.effectiveNextVisit.getTime()
      })
  }, [enriched, selectedFarrier, search])

  const summary = useMemo(() => {
    return FARRIERS.map((farrier) => {
      const items = enriched.filter((horse) => horse.farrier === farrier)

      return {
        farrier,
        total: items.length,
        urgent: items.filter((horse) => horse.status === 'urgent').length,
        overdue: items.filter((horse) => horse.status === 'overdue').length,
        soon: items.filter((horse) => horse.status === 'soon').length,
      }
    })
  }, [enriched])

  const availableLostShoeHorses = useMemo(() => {
    return enriched
      .filter((horse) => !horse.lostShoeAlert)
      .sort((a, b) => a.horseName.localeCompare(b.horseName))
  }, [enriched])

  async function handleMarkDone(id: string) {
    const horse = horses.find((item) => item.id === id)
    if (!horse) return

    const newDate = todayString()
    const visitType = horse.lostShoeAlert ? 'lost_shoe' : 'regular'

    setSavingId(id)
    setError('')

    const { error: updateError } = await supabase
      .from('horses')
      .update({
        last_farrier_date: newDate,
        farrier_postponed_until: null,
        lost_shoe_alert: false,
        lost_shoe_reported_at: null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating horse farrier state:', updateError)
      setError(updateError.message)
      setSavingId(null)
      return
    }

    const { error: insertError } = await supabase
      .from('farrier_visits')
      .insert({
        horse_id: horse.id,
        horse_name: horse.horseName,
        farrier_name: horse.farrier || null,
        visit_date: newDate,
        visit_type: visitType,
        notes: horse.notes || null,
      })

    if (insertError) {
      console.error('Error inserting farrier history:', insertError)
      setError(insertError.message)
      setSavingId(null)
      return
    }

    setHorses((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              lastVisit: newDate,
              postponedUntil: null,
              lostShoeAlert: false,
              lostShoeReportedAt: null,
            }
          : item
      )
    )

    setSavingId(null)
  }

  async function handleDelayWeek(id: string, currentNextDate: Date) {
    setSavingId(id)
    setError('')

    const delayedDate = new Date(currentNextDate)
    delayedDate.setDate(delayedDate.getDate() + 7)
    const delayedString = delayedDate.toISOString().slice(0, 10)

    const { error } = await supabase
      .from('horses')
      .update({
        farrier_postponed_until: delayedString,
      })
      .eq('id', id)

    if (error) {
      console.error('Error delaying farrier date:', error)
      setError(error.message)
      setSavingId(null)
      return
    }

    setHorses((prev) =>
      prev.map((horse) =>
        horse.id === id
          ? {
              ...horse,
              postponedUntil: delayedString,
            }
          : horse
      )
    )

    setSavingId(null)
  }

  async function submitLostShoe() {
    if (!lostShoeHorseId) return

    setSavingId(lostShoeHorseId)
    setError('')

    const now = nowIsoString()

    const { error } = await supabase
      .from('horses')
      .update({
        lost_shoe_alert: true,
        lost_shoe_reported_at: now,
      })
      .eq('id', lostShoeHorseId)

    if (error) {
      console.error('Error reporting lost shoe:', error)
      setError(error.message)
      setSavingId(null)
      return
    }

    setHorses((prev) =>
      prev.map((horse) =>
        horse.id === lostShoeHorseId
          ? {
              ...horse,
              lostShoeAlert: true,
              lostShoeReportedAt: now,
            }
          : horse
      )
    )

    setLostShoeOpen(false)
    setLostShoeHorseId('')
    setSavingId(null)
  }

  return (
    <div className="farrier-tab-om">
      <div className="farrier-head-om">
        <div className="farrier-head-copy-om">
          <span className="farrier-kicker-om">Hoof Care</span>
          <h2 className="farrier-title-om">Farrier follow-up</h2>
          <p className="farrier-text-om">
            Quiet overview of urgent cases, due dates and small follow-up actions.
          </p>
        </div>

        <div className="farrier-controls-om">
          <input
            className="farrier-search-om"
            type="text"
            placeholder="Search horse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="farrier-select-om"
            value={selectedFarrier}
            onChange={(e) => setSelectedFarrier(e.target.value as FarrierName | 'All')}
          >
            <option value="All">All farriers</option>
            {FARRIERS.map((farrier) => (
              <option key={farrier} value={farrier}>
                {farrier}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="farrier-top-action-om"
            onClick={() => setLostShoeOpen(true)}
          >
            Lost shoe
          </button>
        </div>
      </div>

      {error ? <div className="farrier-error-om">{error}</div> : null}

      {lostShoeOpen && (
        <div className="farrier-modal-backdrop-om" onClick={() => setLostShoeOpen(false)}>
          <div className="farrier-modal-om" onClick={(e) => e.stopPropagation()}>
            <div className="farrier-modal-head-om">
              <span className="farrier-kicker-om">Urgent</span>
              <h3 className="farrier-modal-title-om">Report lost shoe</h3>
            </div>

            <div className="farrier-modal-body-om">
              <select
                className="farrier-modal-select-om"
                value={lostShoeHorseId}
                onChange={(e) => setLostShoeHorseId(e.target.value)}
              >
                <option value="">Select horse</option>
                {availableLostShoeHorses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.horseName}
                  </option>
                ))}
              </select>
            </div>

            <div className="farrier-modal-actions-om">
              <button
                type="button"
                className="farrier-modal-secondary-om"
                onClick={() => {
                  setLostShoeOpen(false)
                  setLostShoeHorseId('')
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="farrier-modal-primary-om"
                onClick={submitLostShoe}
                disabled={!lostShoeHorseId || savingId === lostShoeHorseId}
              >
                {savingId === lostShoeHorseId ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {urgentItems.length > 0 && (
        <div className="farrier-urgent-wrap-om">
          <div className="farrier-urgent-head-om">
            <span className="farrier-urgent-kicker-om">Urgent</span>
            <h3 className="farrier-urgent-title-om">Lost shoe alerts</h3>
          </div>

          <div className="farrier-urgent-list-om">
            {urgentItems.map((horse) => (
              <div key={horse.id} className="farrier-urgent-card-om">
                <div className="farrier-urgent-card-main-om">
                  <div className="farrier-urgent-horse-om">{horse.horseName}</div>
                  <div className="farrier-urgent-meta-om">
                    First available farrier can do this one
                  </div>
                </div>

                <button
                  type="button"
                  className="farrier-resolve-btn-om"
                  onClick={() => handleMarkDone(horse.id)}
                  disabled={savingId === horse.id}
                >
                  {savingId === horse.id ? 'Saving...' : 'Resolved'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="farrier-summary-grid-om">
        {summary.map((item) => (
          <button
            key={item.farrier}
            type="button"
            className={`farrier-summary-card-om ${
              selectedFarrier === item.farrier ? 'active' : ''
            }`}
            onClick={() =>
              setSelectedFarrier((prev) => (prev === item.farrier ? 'All' : item.farrier))
            }
          >
            <div className="farrier-summary-top-om">
              <span className="farrier-summary-name-om">{item.farrier}</span>
              <span className="farrier-summary-total-om">{item.total} horses</span>
            </div>

            <div className="farrier-badges-om">
              <span className="farrier-badge-om farrier-badge-red-strong-om">
                {item.urgent} urgent
              </span>
              <span className="farrier-badge-om farrier-badge-red-om">
                {item.overdue} overdue
              </span>
              <span className="farrier-badge-om farrier-badge-yellow-om">
                {item.soon} soon
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="farrier-mobile-list-om">
        {loading ? (
          <div className="farrier-empty-om">Loading horses...</div>
        ) : filtered.length === 0 ? (
          <div className="farrier-empty-om">No horses found.</div>
        ) : (
          filtered.map((horse) => (
            <div key={horse.id} className="farrier-mobile-card-om">
              <div className="farrier-mobile-card-top-om">
                <div>
                  <div className="farrier-mobile-horse-om">{horse.horseName}</div>
                  <div className="farrier-mobile-farrier-om">{horse.farrier || 'No farrier'}</div>
                </div>

                <span className={`farrier-status-om farrier-status-${horse.status}-om`}>
                  {getStatusLabel(horse.status)}
                </span>
              </div>

              <div className="farrier-mobile-grid-om">
                <div className="farrier-mobile-item-om">
                  <span className="farrier-mobile-label-om">Last visit</span>
                  <strong>{formatDate(new Date(horse.safeLastVisit))}</strong>
                </div>

                <div className="farrier-mobile-item-om">
                  <span className="farrier-mobile-label-om">Interval</span>
                  <strong>{horse.intervalDays} days</strong>
                </div>

                <div className="farrier-mobile-item-om">
                  <span className="farrier-mobile-label-om">Next due</span>
                  <strong>{formatDate(horse.effectiveNextVisit)}</strong>
                  {horse.postponedUntil ? (
                    <small className="farrier-delay-note-om">+1 week applied</small>
                  ) : null}
                </div>

                <div className="farrier-mobile-item-om farrier-mobile-item-full-om">
                  <span className="farrier-mobile-label-om">Notes</span>
                  <strong className="farrier-mobile-notes-om">{horse.notes || '—'}</strong>
                </div>
              </div>

              <div className="farrier-mobile-actions-om">
                <button
                  type="button"
                  className="farrier-table-btn-om farrier-mobile-action-btn-om"
                  onClick={() => handleMarkDone(horse.id)}
                  disabled={savingId === horse.id}
                >
                  {savingId === horse.id ? '...' : 'Done'}
                </button>

                <button
                  type="button"
                  className="farrier-mobile-delay-btn-om"
                  onClick={() => handleDelayWeek(horse.id, horse.effectiveNextVisit)}
                  disabled={savingId === horse.id || horse.lostShoeAlert}
                >
                  Delay 1w
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="farrier-table-shell-om">
        <table className="farrier-table-om">
          <thead>
            <tr>
              <th>Horse</th>
              <th>Farrier</th>
              <th>Last visit</th>
              <th>Interval</th>
              <th>Next due</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Done</th>
              <th>Delay</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9}>
                  <div className="farrier-empty-om">Loading horses...</div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="farrier-empty-om">No horses found.</div>
                </td>
              </tr>
            ) : (
              filtered.map((horse) => (
                <tr key={horse.id}>
                  <td>
                    <span className="farrier-horse-name-om">{horse.horseName}</span>
                  </td>

                  <td>{horse.farrier || '—'}</td>
                  <td>{formatDate(new Date(horse.safeLastVisit))}</td>
                  <td>{horse.intervalDays} days</td>

                  <td>
                    <div className="farrier-next-date-om">
                      <span>{formatDate(horse.effectiveNextVisit)}</span>
                      {horse.postponedUntil ? (
                        <small className="farrier-delay-note-om">+1 week applied</small>
                      ) : null}
                    </div>
                  </td>

                  <td>
                    <span className={`farrier-status-om farrier-status-${horse.status}-om`}>
                      {getStatusLabel(horse.status)}
                    </span>
                  </td>

                  <td className="farrier-notes-om">{horse.notes || '—'}</td>

                  <td>
                    <button
                      type="button"
                      className="farrier-table-btn-om"
                      onClick={() => handleMarkDone(horse.id)}
                      disabled={savingId === horse.id}
                    >
                      {savingId === horse.id ? '...' : 'Done'}
                    </button>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="farrier-table-link-om"
                      onClick={() => handleDelayWeek(horse.id, horse.effectiveNextVisit)}
                      disabled={savingId === horse.id || horse.lostShoeAlert}
                    >
                      Delay 1w
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}