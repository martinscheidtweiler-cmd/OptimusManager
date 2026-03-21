'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './FarrierTab.css'

type FarrierName = 'Maarten' | 'Kamiel' | 'Johan' | 'Wim'
type Status = 'urgent' | 'overdue' | 'soon' | 'ok'
type VisitType = 'regular' | 'lost_shoe'
type ShoeingType = 'trim' | 'front' | 'square'
type HorseType = 'Sport horse' | 'Young horse' | 'Foal' | 'Mare' | 'Mare with foal'
type HorseCategoryFilter = 'All' | 'Sporthorses' | 'Young horses' | 'Breedingmares'

type HorseRow = {
  id: string
  name: string | null
  active: boolean | null
  horse_type: HorseType | null
  farrier_name: string | null
  farrier_last_done: string | null
  farrier_interval_weeks: number | null
  farrier_shoeing_type: string | null
  notes: string | null
  farrier_postponed_until: string | null
  lost_shoe_alert: boolean | null
  lost_shoe_reported_at: string | null
}

type HorseFarrierItem = {
  id: string
  horseName: string
  horseType: HorseType | null
  farrier: FarrierName | ''
  lastVisit: string | null
  intervalWeeks: number
  shoeingType: ShoeingType | ''
  notes: string
  postponedUntil: string | null
  lostShoeAlert: boolean
  lostShoeReportedAt: string | null
}

type EnrichedHorse = HorseFarrierItem & {
  baseNextVisit: Date | null
  effectiveNextVisit: Date | null
  status: Status
}

type FarrierVisit = {
  id: string
  horse_id: string | null
  horse_name: string | null
  farrier_name: string | null
  visit_date: string | null
  visit_type: string | null
  interval_weeks: number | null
  shoeing_type: string | null
  notes: string | null
  created_at: string | null
}

const FARRIERS: FarrierName[] = ['Maarten', 'Kamiel', 'Johan', 'Wim']
const SHOEING_TYPES: ShoeingType[] = ['trim', 'front', 'square']

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return date
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function formatDateString(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return formatDate(date)
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

function getShoeingLabel(value: ShoeingType | '' | null) {
  if (value === 'trim') return 'Trim'
  if (value === 'front') return 'Front'
  if (value === 'square') return 'Square'
  return '—'
}

function matchesHorseCategory(
  horseType: HorseType | null,
  filter: HorseCategoryFilter
) {
  if (filter === 'All') return true
  if (filter === 'Sporthorses') return horseType === 'Sport horse'
  if (filter === 'Young horses') {
    return horseType === 'Young horse' || horseType === 'Foal'
  }
  if (filter === 'Breedingmares') {
    return horseType === 'Mare' || horseType === 'Mare with foal'
  }
  return true
}

export default function FarrierTab() {
  const [horses, setHorses] = useState<HorseFarrierItem[]>([])
  const [horseCategory, setHorseCategory] = useState<HorseCategoryFilter>('All')
  const [selectedFarrier, setSelectedFarrier] = useState<FarrierName | 'All'>('All')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [lostShoeOpen, setLostShoeOpen] = useState(false)
  const [lostShoeHorseId, setLostShoeHorseId] = useState('')

  const [updateOpen, setUpdateOpen] = useState(false)
  const [editingHorseId, setEditingHorseId] = useState<string>('')
  const [visitDate, setVisitDate] = useState(todayString())
  const [visitFarrier, setVisitFarrier] = useState<FarrierName | ''>('')
  const [visitIntervalWeeks, setVisitIntervalWeeks] = useState('6')
  const [visitShoeingType, setVisitShoeingType] = useState<ShoeingType | ''>('')
  const [visitNotes, setVisitNotes] = useState('')

  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [visitHistory, setVisitHistory] = useState<Record<string, FarrierVisit[]>>({})
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null)

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
        horse_type,
        farrier_name,
        farrier_last_done,
        farrier_interval_weeks,
        farrier_shoeing_type,
        notes,
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
      horseType: horse.horse_type,
      farrier: FARRIERS.includes(horse.farrier_name as FarrierName)
        ? (horse.farrier_name as FarrierName)
        : '',
      lastVisit: horse.farrier_last_done,
      intervalWeeks: horse.farrier_interval_weeks || 6,
      shoeingType: SHOEING_TYPES.includes(horse.farrier_shoeing_type as ShoeingType)
        ? (horse.farrier_shoeing_type as ShoeingType)
        : '',
      notes: horse.notes || '',
      postponedUntil: horse.farrier_postponed_until,
      lostShoeAlert: !!horse.lost_shoe_alert,
      lostShoeReportedAt: horse.lost_shoe_reported_at,
    }))

    setHorses(mapped)
    setLoading(false)
  }

  const enriched = useMemo<EnrichedHorse[]>(() => {
    return horses.map((horse) => {
      const baseNextVisit = horse.lastVisit
        ? addDays(horse.lastVisit, horse.intervalWeeks * 7)
        : null

      let effectiveNextVisit = baseNextVisit

      if (horse.postponedUntil) {
        const postponedDate = new Date(horse.postponedUntil)
        if (!effectiveNextVisit || postponedDate.getTime() > effectiveNextVisit.getTime()) {
          effectiveNextVisit = postponedDate
        }
      }

      let status: Status = 'ok'

      if (horse.lostShoeAlert) {
        status = 'urgent'
      } else if (!effectiveNextVisit) {
        status = 'ok'
      } else {
        const daysLeft = diffInDays(new Date(), effectiveNextVisit)
        if (daysLeft < 0) status = 'overdue'
        else if (daysLeft <= 14) status = 'soon'
      }

      return {
        ...horse,
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

        const matchesSearch = horse.horseName.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = matchesHorseCategory(horse.horseType, horseCategory)

        return matchesFarrier && matchesSearch && matchesCategory
      })
      .sort((a, b) => {
        const order = { urgent: 0, overdue: 1, soon: 2, ok: 3 }
        const statusDiff = order[a.status] - order[b.status]
        if (statusDiff !== 0) return statusDiff

        const aTime = a.effectiveNextVisit ? a.effectiveNextVisit.getTime() : Number.MAX_SAFE_INTEGER
        const bTime = b.effectiveNextVisit ? b.effectiveNextVisit.getTime() : Number.MAX_SAFE_INTEGER
        return aTime - bTime
      })
  }, [enriched, selectedFarrier, search, horseCategory])

  const summary = useMemo(() => {
    return FARRIERS.map((farrier) => {
      const items = enriched.filter(
        (horse) =>
          horse.farrier === farrier &&
          matchesHorseCategory(horse.horseType, horseCategory)
      )

      return {
        farrier,
        total: items.length,
        urgent: items.filter((horse) => horse.status === 'urgent').length,
        overdue: items.filter((horse) => horse.status === 'overdue').length,
        soon: items.filter((horse) => horse.status === 'soon').length,
      }
    })
  }, [enriched, horseCategory])

  const availableLostShoeHorses = useMemo(() => {
    return enriched
      .filter(
        (horse) =>
          !horse.lostShoeAlert && matchesHorseCategory(horse.horseType, horseCategory)
      )
      .sort((a, b) => a.horseName.localeCompare(b.horseName))
  }, [enriched, horseCategory])

  const editingHorse = useMemo(() => {
    return horses.find((horse) => horse.id === editingHorseId) || null
  }, [horses, editingHorseId])

  function openUpdateModal(horse: HorseFarrierItem) {
    setEditingHorseId(horse.id)
    setVisitDate(todayString())
    setVisitFarrier(horse.farrier || '')
    setVisitIntervalWeeks(String(horse.intervalWeeks || 6))
    setVisitShoeingType(horse.shoeingType || '')
    setVisitNotes('')
    setUpdateOpen(true)
  }

  function closeUpdateModal() {
    setUpdateOpen(false)
    setEditingHorseId('')
    setVisitDate(todayString())
    setVisitFarrier('')
    setVisitIntervalWeeks('6')
    setVisitShoeingType('')
    setVisitNotes('')
  }

  async function loadVisitHistory(horseId: string) {
    setHistoryLoadingId(horseId)
    setError('')

    const { data, error } = await supabase
      .from('farrier_visits')
      .select(`
        id,
        horse_id,
        horse_name,
        farrier_name,
        visit_date,
        visit_type,
        interval_weeks,
        shoeing_type,
        notes,
        created_at
      `)
      .eq('horse_id', horseId)
      .order('visit_date', { ascending: false })

    if (error) {
      console.error('Error loading farrier history:', error)
      setError(error.message)
      setHistoryLoadingId(null)
      return
    }

    setVisitHistory((prev) => ({
      ...prev,
      [horseId]: (data || []) as FarrierVisit[],
    }))

    setHistoryLoadingId(null)
  }

  async function toggleHistory(horseId: string) {
    if (expandedHistoryId === horseId) {
      setExpandedHistoryId(null)
      return
    }

    setExpandedHistoryId(horseId)

    if (!visitHistory[horseId]) {
      await loadVisitHistory(horseId)
    }
  }

  async function saveVisit() {
    if (!editingHorse) return
    if (!visitDate) return
    if (!visitIntervalWeeks || Number(visitIntervalWeeks) <= 0) return

    setSavingId(editingHorse.id)
    setError('')

    const intervalWeeksNumber = Number(visitIntervalWeeks)
    const visitType: VisitType = editingHorse.lostShoeAlert ? 'lost_shoe' : 'regular'

    const { error: updateError } = await supabase
      .from('horses')
      .update({
        farrier_last_done: visitDate,
        farrier_name: visitFarrier || null,
        farrier_interval_weeks: intervalWeeksNumber,
        farrier_shoeing_type: visitShoeingType || null,
        farrier_postponed_until: null,
        lost_shoe_alert: false,
        lost_shoe_reported_at: null,
      })
      .eq('id', editingHorse.id)

    if (updateError) {
      console.error('Error updating horse farrier state:', updateError)
      setError(updateError.message)
      setSavingId(null)
      return
    }

    const { error: insertError } = await supabase
      .from('farrier_visits')
      .insert({
        horse_id: editingHorse.id,
        horse_name: editingHorse.horseName,
        farrier_name: visitFarrier || null,
        visit_date: visitDate,
        visit_type: visitType,
        interval_weeks: intervalWeeksNumber,
        shoeing_type: visitShoeingType || null,
        notes: visitNotes || null,
      })

    if (insertError) {
      console.error('Error inserting farrier history:', insertError)
      setError(insertError.message)
      setSavingId(null)
      return
    }

    setHorses((prev) =>
      prev.map((horse) =>
        horse.id === editingHorse.id
          ? {
              ...horse,
              farrier: visitFarrier,
              lastVisit: visitDate,
              intervalWeeks: intervalWeeksNumber,
              shoeingType: visitShoeingType,
              postponedUntil: null,
              lostShoeAlert: false,
              lostShoeReportedAt: null,
            }
          : horse
      )
    )

    if (visitHistory[editingHorse.id] || expandedHistoryId === editingHorse.id) {
      await loadVisitHistory(editingHorse.id)
    }

    setSavingId(null)
    closeUpdateModal()
  }

  async function delayWeekFromModal() {
    if (!editingHorse) return

    setSavingId(editingHorse.id)
    setError('')

    const currentBase =
      editingHorse.lastVisit
        ? addDays(editingHorse.lastVisit, editingHorse.intervalWeeks * 7)
        : new Date()

    const delayedDate = new Date(currentBase)
    delayedDate.setDate(delayedDate.getDate() + 7)
    const delayedString = delayedDate.toISOString().slice(0, 10)

    const { error } = await supabase
      .from('horses')
      .update({
        farrier_postponed_until: delayedString,
      })
      .eq('id', editingHorse.id)

    if (error) {
      console.error('Error delaying farrier date:', error)
      setError(error.message)
      setSavingId(null)
      return
    }

    setHorses((prev) =>
      prev.map((horse) =>
        horse.id === editingHorse.id
          ? {
              ...horse,
              postponedUntil: delayedString,
            }
          : horse
      )
    )

    setSavingId(null)
    closeUpdateModal()
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
            Quiet overview of urgent cases, due dates and follow-up actions.
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

          <button
            type="button"
            className="farrier-top-action-om"
            onClick={() => setLostShoeOpen(true)}
          >
            Lost shoe
          </button>
        </div>
      </div>

      <div className="farrier-category-filters-om">
        <button
          type="button"
          className={`farrier-category-btn-om ${horseCategory === 'All' ? 'active' : ''}`}
          onClick={() => setHorseCategory('All')}
        >
          All
        </button>

        <button
          type="button"
          className={`farrier-category-btn-om ${horseCategory === 'Sporthorses' ? 'active' : ''}`}
          onClick={() => setHorseCategory('Sporthorses')}
        >
          Sporthorses
        </button>

        <button
          type="button"
          className={`farrier-category-btn-om ${horseCategory === 'Young horses' ? 'active' : ''}`}
          onClick={() => setHorseCategory('Young horses')}
        >
          Young horses
        </button>

        <button
          type="button"
          className={`farrier-category-btn-om ${horseCategory === 'Breedingmares' ? 'active' : ''}`}
          onClick={() => setHorseCategory('Breedingmares')}
        >
          Breedingmares
        </button>
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

      {updateOpen && editingHorse && (
        <div className="farrier-modal-backdrop-om" onClick={closeUpdateModal}>
          <div
            className="farrier-modal-om farrier-update-modal-om"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="farrier-delay-corner-om"
              onClick={delayWeekFromModal}
              disabled={savingId === editingHorse.id}
            >
              {savingId === editingHorse.id ? 'Saving...' : 'Delay 1 week'}
            </button>

            <div className="farrier-modal-head-om">
              <span className="farrier-kicker-om">Farrier update</span>
              <h3 className="farrier-modal-title-om">{editingHorse.horseName}</h3>
            </div>

            <div className="farrier-modal-body-om farrier-form-grid-om">
              <div className="farrier-form-field-om">
                <label>Visit date</label>
                <input
                  className="farrier-modal-input-om"
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>

              <div className="farrier-form-field-om">
                <label>Farrier</label>
                <select
                  className="farrier-modal-select-om"
                  value={visitFarrier}
                  onChange={(e) => setVisitFarrier(e.target.value as FarrierName | '')}
                >
                  <option value="">Select farrier</option>
                  {FARRIERS.map((farrier) => (
                    <option key={farrier} value={farrier}>
                      {farrier}
                    </option>
                  ))}
                </select>
              </div>

              <div className="farrier-form-field-om">
                <label>Next in weeks</label>
                <input
                  className="farrier-modal-input-om"
                  type="number"
                  min="1"
                  value={visitIntervalWeeks}
                  onChange={(e) => setVisitIntervalWeeks(e.target.value)}
                />
              </div>

              <div className="farrier-form-field-om">
                <label>Shoeing</label>
                <select
                  className="farrier-modal-select-om"
                  value={visitShoeingType}
                  onChange={(e) => setVisitShoeingType(e.target.value as ShoeingType | '')}
                >
                  <option value="">Select type</option>
                  <option value="trim">Trim</option>
                  <option value="front">Front</option>
                  <option value="square">Square</option>
                </select>
              </div>

              <div className="farrier-form-field-om farrier-form-field-full-om">
                <label>Visit notes</label>
                <textarea
                  className="farrier-modal-textarea-om"
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="Optional notes..."
                  rows={4}
                />
              </div>
            </div>

            <div className="farrier-modal-actions-om">
              <button
                type="button"
                className="farrier-modal-secondary-om"
                onClick={closeUpdateModal}
              >
                Cancel
              </button>

              <button
                type="button"
                className="farrier-modal-primary-om"
                onClick={saveVisit}
                disabled={
                  savingId === editingHorse.id ||
                  !visitDate ||
                  !visitIntervalWeeks ||
                  Number(visitIntervalWeeks) <= 0
                }
              >
                {savingId === editingHorse.id ? 'Saving...' : 'Save visit'}
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
                  onClick={() => openUpdateModal(horse)}
                >
                  Update
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
            <div key={horse.id} className="farrier-mobile-card-shell-om">
              <div
                className="farrier-mobile-card-om"
                role="button"
                tabIndex={0}
                onClick={() => toggleHistory(horse.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleHistory(horse.id)
                  }
                }}
              >
                <div className="farrier-mobile-card-top-om">
                  <div className="farrier-mobile-card-head-om">
                    <div className="farrier-mobile-horse-om">{horse.horseName}</div>
                    <div className="farrier-mobile-inline-meta-om">
                      {horse.farrier || 'No farrier'} - {getShoeingLabel(horse.shoeingType)} -{' '}
                      {horse.intervalWeeks} weeks
                    </div>
                  </div>

                  <span className={`farrier-status-om farrier-status-${horse.status}-om`}>
                    {getStatusLabel(horse.status)}
                  </span>
                </div>

                <div className="farrier-mobile-grid-om">
                  <div className="farrier-mobile-item-om">
                    <span className="farrier-mobile-label-om">Last visit</span>
                    <strong>{formatDateString(horse.lastVisit)}</strong>
                  </div>

                  <div className="farrier-mobile-item-om">
                    <span className="farrier-mobile-label-om">Next due</span>
                    <strong>
                      {horse.effectiveNextVisit ? formatDate(horse.effectiveNextVisit) : '—'}
                    </strong>
                    {horse.postponedUntil ? (
                      <small className="farrier-delay-note-om">+1 week applied</small>
                    ) : null}
                  </div>

                  {horse.notes?.trim() ? (
                    <div className="farrier-mobile-item-om farrier-mobile-item-full-om">
                      <span className="farrier-mobile-label-om">Notes</span>
                      <strong className="farrier-mobile-notes-om">{horse.notes}</strong>
                    </div>
                  ) : null}
                </div>

                <div className="farrier-mobile-actions-om" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="farrier-table-btn-om farrier-mobile-action-btn-om"
                    onClick={() => openUpdateModal(horse)}
                  >
                    Update
                  </button>
                </div>
              </div>

              {expandedHistoryId === horse.id && (
                <div className="farrier-history-box-om">
                  {historyLoadingId === horse.id ? (
                    <div className="farrier-history-empty-om">Loading history...</div>
                  ) : (visitHistory[horse.id] || []).length === 0 ? (
                    <div className="farrier-history-empty-om">No history yet.</div>
                  ) : (
                    (visitHistory[horse.id] || []).map((item) => (
                      <div key={item.id} className="farrier-history-row-om">
                        <div className="farrier-history-date-om">
                          {formatDateString(item.visit_date)}
                        </div>
                        <div className="farrier-history-main-om">
                          <strong>
                            {(item.farrier_name || '—')} ·{' '}
                            {getShoeingLabel(item.shoeing_type as ShoeingType | '' | null)}
                          </strong>
                          <span>
                            {item.interval_weeks ? `${item.interval_weeks} weeks` : '—'}
                          </span>
                        </div>
                        <div className="farrier-history-notes-om">
                          {item.notes || item.visit_type || '—'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
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
              <th>Shoeing</th>
              <th>Next due</th>
              <th>Status</th>
              <th>Notes</th>
              <th>Update</th>
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
                <React.Fragment key={horse.id}>
                  <tr
                    className="farrier-click-row-om"
                    onClick={() => toggleHistory(horse.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleHistory(horse.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td>
                      <span className="farrier-horse-name-om">{horse.horseName}</span>
                    </td>

                    <td>{horse.farrier || '—'}</td>
                    <td>{formatDateString(horse.lastVisit)}</td>
                    <td>{horse.intervalWeeks} weeks</td>
                    <td>{getShoeingLabel(horse.shoeingType)}</td>

                    <td>
                      <div className="farrier-next-date-om">
                        <span>
                          {horse.effectiveNextVisit ? formatDate(horse.effectiveNextVisit) : '—'}
                        </span>
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

                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="farrier-table-btn-om"
                        onClick={() => openUpdateModal(horse)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>

                  {expandedHistoryId === horse.id && (
                    <tr>
                      <td colSpan={9}>
                        <div className="farrier-history-box-om">
                          {historyLoadingId === horse.id ? (
                            <div className="farrier-history-empty-om">Loading history...</div>
                          ) : (visitHistory[horse.id] || []).length === 0 ? (
                            <div className="farrier-history-empty-om">No history yet.</div>
                          ) : (
                            (visitHistory[horse.id] || []).map((item) => (
                              <div key={item.id} className="farrier-history-row-om">
                                <div className="farrier-history-date-om">
                                  {formatDateString(item.visit_date)}
                                </div>
                                <div className="farrier-history-main-om">
                                  <strong>
                                    {(item.farrier_name || '—')} ·{' '}
                                    {getShoeingLabel(item.shoeing_type as ShoeingType | '' | null)}
                                  </strong>
                                  <span>
                                    {item.interval_weeks ? `${item.interval_weeks} weeks` : '—'}
                                  </span>
                                </div>
                                <div className="farrier-history-notes-om">
                                  {item.notes || item.visit_type || '—'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}