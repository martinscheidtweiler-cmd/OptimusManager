'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import styles from './HorsesTab.module.css'

type HorseType = 'Sport horse' | 'Young horse' | 'Foal' | 'Mare' | 'Mare with foal'
type StableStatus = 'active' | 'away' | 'inactive'
type StableLocation = '47B' | '47B Big Box' | '50' | 'Oostm' | 'Serre' | 'Vremde'
type VaccineType = 'flu_tetanus' | 'rhino'

type Horse = {
  id: string
  name: string
  active: boolean | null
  horse_type: HorseType | null
  stable_status: StableStatus | null
  left_stable_at: string | null
  returned_stable_at: string | null
  moved_to_location: string | null
  moved_to_detail: string | null
  farrier_name: string | null
  farrier_last_done: string | null
  farrier_interval_weeks: number | null
  stable_location: StableLocation | null
  box_number: string | null
  pasture_name: string | null
  show_in_rider_planning: boolean | null
  show_in_mare_cards: boolean | null
  show_in_tasks: boolean | null
  last_in_heat_date: string | null
  pregnant: boolean | null
  pregnancy_notes: string | null
  notes: string | null
}

type Vaccination = {
  id: string
  horse_id: string
  vaccine_type: VaccineType
  administered_on: string
  next_due_on: string | null
  product_name: string | null
  notes: string | null
  created_at: string
}

type DewormingRecord = {
  id: string
  horse_id: string
  administered_on: string
  next_due_on: string | null
  product_name: string | null
  notes: string | null
  created_at: string
}

type FarrierVisit = {
  id: string
  horse_id: string | null
  horse_name: string | null
  farrier_name: string | null
  visit_date: string | null
  visit_type: string | null
  interval_weeks: number | null
  notes: string | null
  created_at: string | null
}

type QuickCareMenu = 'Vaccinations' | 'Deworming' | 'Visits' | 'Farrier'

export default function HorsesTab({
  onVetQuickAction,
}: {
  onVetQuickAction?: (menu: QuickCareMenu, horseId: string, vaccineType?: VaccineType) => void
}) {
  const router = useRouter()

  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Inactive'>('Active')
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteFeedback, setNoteFeedback] = useState('')
  const [showAllActivity, setShowAllActivity] = useState(false)

  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [vaccinationsLoading, setVaccinationsLoading] = useState(false)

  const [dewormingRecords, setDewormingRecords] = useState<DewormingRecord[]>([])
  const [dewormingLoading, setDewormingLoading] = useState(false)

  const [farrierHistory, setFarrierHistory] = useState<FarrierVisit[]>([])
  const [farrierHistoryLoading, setFarrierHistoryLoading] = useState(false)

  const [historyOpen, setHistoryOpen] = useState<{
    flu_tetanus: boolean
    rhino: boolean
    deworming: boolean
    farrier: boolean
  }>({
    flu_tetanus: false,
    rhino: false,
    deworming: false,
    farrier: false,
  })

  const loadHorses = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('horses')
        .select(`
          id,
          name,
          active,
          horse_type,
          stable_status,
          left_stable_at,
          returned_stable_at,
          moved_to_location,
          moved_to_detail,
          farrier_name,
          farrier_last_done,
          farrier_interval_weeks,
          stable_location,
          box_number,
          pasture_name,
          show_in_rider_planning,
          show_in_mare_cards,
          show_in_tasks,
          last_in_heat_date,
          pregnant,
          pregnancy_notes,
          notes
        `)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error loading horses:', error)
        setHorses([])
        return
      }

      setHorses((data || []) as Horse[])
    } catch (err) {
      console.error('Unexpected error loading horses:', err)
      setHorses([])
    } finally {
      setLoading(false)
    }
  }

  const loadVaccinations = async (horseId: string) => {
    setVaccinationsLoading(true)

    try {
      const { data, error } = await supabase
        .from('vaccination_records')
        .select(`
          id,
          horse_id,
          vaccine_type,
          administered_on,
          next_due_on,
          product_name,
          notes,
          created_at
        `)
        .eq('horse_id', horseId)
        .order('administered_on', { ascending: false })

      if (error) {
        console.error('Error loading vaccinations:', error)
        setVaccinations([])
        return
      }

      setVaccinations((data || []) as Vaccination[])
    } catch (err) {
      console.error('Unexpected error loading vaccinations:', err)
      setVaccinations([])
    } finally {
      setVaccinationsLoading(false)
    }
  }

  const loadDeworming = async (horseId: string) => {
    setDewormingLoading(true)

    try {
      const { data, error } = await supabase
        .from('deworming_records')
        .select(`
          id,
          horse_id,
          administered_on,
          next_due_on,
          product_name,
          notes,
          created_at
        `)
        .eq('horse_id', horseId)
        .order('administered_on', { ascending: false })

      if (error) {
        console.error('Error loading deworming:', error)
        setDewormingRecords([])
        return
      }

      setDewormingRecords((data || []) as DewormingRecord[])
    } catch (err) {
      console.error('Unexpected error loading deworming:', err)
      setDewormingRecords([])
    } finally {
      setDewormingLoading(false)
    }
  }

  const loadFarrierHistory = async (horseId: string) => {
    setFarrierHistoryLoading(true)

    try {
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
          notes,
          created_at
        `)
        .eq('horse_id', horseId)
        .order('visit_date', { ascending: false })

      if (error) {
        console.error('Error loading farrier history:', error)
        setFarrierHistory([])
        return
      }

      setFarrierHistory((data || []) as FarrierVisit[])
    } catch (err) {
      console.error('Unexpected error loading farrier history:', err)
      setFarrierHistory([])
    } finally {
      setFarrierHistoryLoading(false)
    }
  }

  useEffect(() => {
    loadHorses()
  }, [])

  const filteredHorses = useMemo(() => {
    return horses.filter((horse) => {
      const matchesSearch = (horse.name || '')
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesActive =
        activeFilter === 'All'
          ? true
          : activeFilter === 'Active'
            ? horse.active !== false
            : horse.active === false

      return matchesSearch && matchesActive
    })
  }, [horses, search, activeFilter])

  const selectedHorse = useMemo(() => {
    return horses.find((horse) => horse.id === selectedHorseId) || null
  }, [horses, selectedHorseId])

  const fluVaccinations = useMemo(() => {
    return vaccinations.filter((v) => v.vaccine_type === 'flu_tetanus')
  }, [vaccinations])

  const rhinoVaccinations = useMemo(() => {
    return vaccinations.filter((v) => v.vaccine_type === 'rhino')
  }, [vaccinations])

  const latestFlu = fluVaccinations[0] || null
  const latestRhino = rhinoVaccinations[0] || null
  const latestDeworming = dewormingRecords[0] || null

  const openHorse = async (horse: Horse) => {
    setSelectedHorseId(horse.id)
    setNoteDraft(horse.notes || '')
    setNoteEditing(false)
    setNoteFeedback('')
    setShowAllActivity(false)
    setHistoryOpen({
      flu_tetanus: false,
      rhino: false,
      deworming: false,
      farrier: false,
    })
    setFarrierHistory([])

    await Promise.all([
      loadVaccinations(horse.id),
      loadDeworming(horse.id),
    ])
  }

  const closeHorse = () => {
    setSelectedHorseId(null)
    setNoteEditing(false)
    setNoteFeedback('')
    setVaccinations([])
    setDewormingRecords([])
    setFarrierHistory([])
    setHistoryOpen({
      flu_tetanus: false,
      rhino: false,
      deworming: false,
      farrier: false,
    })
  }

  const formatDate = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(`${value.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString(document.documentElement.lang || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getStatusLabel = (horse: Horse) => {
    if (horse.stable_status === 'away') return 'Away'
    if (horse.stable_status === 'inactive' || horse.active === false) return 'Inactive'
    return 'Active'
  }

  const getStatusClass = (horse: Horse) => {
    if (horse.stable_status === 'away') return styles.awayTag
    if (horse.stable_status === 'inactive' || horse.active === false) return styles.inactiveTag
    return styles.activeTag
  }

  const getStableLocationLabel = (horse: Horse) => {
    if (!horse.stable_location) return '—'

    if (horse.box_number) {
      return `${horse.stable_location} · Box ${horse.box_number}`
    }

    if (horse.pasture_name) {
      return `${horse.stable_location} · ${horse.pasture_name}`
    }

    return horse.stable_location
  }

  const getMovementLabel = (horse: Horse) => {
    if (!horse.moved_to_location && !horse.moved_to_detail) return '—'
    if (horse.moved_to_location && horse.moved_to_detail) {
      return `${horse.moved_to_location} · ${horse.moved_to_detail}`
    }
    return horse.moved_to_location || horse.moved_to_detail || '—'
  }

  const getCareStatus = (dueDate: string | null) => {
    if (!dueDate) return { label: 'No date', tone: styles.statusMissing }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(`${dueDate.slice(0, 10)}T12:00:00`)
    const daysLeft = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
    if (daysLeft < 0) return { label: 'Overdue', tone: styles.statusOverdue }
    if (daysLeft <= 30) return { label: 'Due soon', tone: styles.statusDueSoon }
    return { label: 'Scheduled', tone: styles.statusScheduled }
  }

  const getNextFarrierDateValue = (horse: Horse) => {
    if (!horse.farrier_last_done || !horse.farrier_interval_weeks) return null
    const date = new Date(`${horse.farrier_last_done.slice(0, 10)}T12:00:00`)
    if (Number.isNaN(date.getTime())) return null
    date.setDate(date.getDate() + horse.farrier_interval_weeks * 7)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const saveHorseNote = async () => {
    if (!selectedHorse) return
    setNoteSaving(true)
    setNoteFeedback('')
    const value = noteDraft.trim() || null
    const { error } = await supabase.from('horses').update({ notes: value }).eq('id', selectedHorse.id)
    if (error) {
      setNoteFeedback('Could not save note. Please try again.')
    } else {
      setHorses((current) => current.map((horse) => horse.id === selectedHorse.id ? { ...horse, notes: value } : horse))
      setNoteEditing(false)
      setNoteFeedback('Note saved.')
    }
    setNoteSaving(false)
  }

  const yesNo = (value: boolean | null) => {
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    return '—'
  }

  const toggleFarrierHistory = async () => {
    if (!selectedHorse) return

    if (historyOpen.farrier) {
      setHistoryOpen((prev) => ({
        ...prev,
        farrier: false,
      }))
      return
    }

    setHistoryOpen((prev) => ({
      ...prev,
      farrier: true,
    }))

    await loadFarrierHistory(selectedHorse.id)
  }

  if (selectedHorse) {
    const careRows = [
      { id: 'flu_tetanus', historyKey: 'flu_tetanus' as const, label: 'Flu + tetanus', last: latestFlu?.administered_on || null, due: latestFlu?.next_due_on || null, menu: 'Vaccinations' as const, vaccineType: 'flu_tetanus' as const, history: fluVaccinations.map((item) => ({ id: item.id, date: item.administered_on, due: item.next_due_on, detail: item.product_name || 'Product not specified', notes: item.notes })) },
      { id: 'rhino', historyKey: 'rhino' as const, label: 'Rhino', last: latestRhino?.administered_on || null, due: latestRhino?.next_due_on || null, menu: 'Vaccinations' as const, vaccineType: 'rhino' as const, history: rhinoVaccinations.map((item) => ({ id: item.id, date: item.administered_on, due: item.next_due_on, detail: item.product_name || 'Product not specified', notes: item.notes })) },
      { id: 'deworming', historyKey: 'deworming' as const, label: 'Deworming', last: latestDeworming?.administered_on || null, due: latestDeworming?.next_due_on || null, menu: 'Deworming' as const, vaccineType: undefined, history: dewormingRecords.map((item) => ({ id: item.id, date: item.administered_on, due: item.next_due_on, detail: item.product_name || 'Product not specified', notes: item.notes })) },
      { id: 'farrier', historyKey: 'farrier' as const, label: selectedHorse.farrier_name ? `Farrier · ${selectedHorse.farrier_name}` : 'Farrier', last: selectedHorse.farrier_last_done, due: getNextFarrierDateValue(selectedHorse), menu: 'Farrier' as const, vaccineType: undefined, history: farrierHistory.map((item) => ({ id: item.id, date: item.visit_date, due: null, detail: item.farrier_name || 'Farrier not specified', notes: item.notes || item.visit_type })) },
    ]
    const recentActivity = [
      ...vaccinations.map((item) => ({ id: item.id, date: item.administered_on, title: `Vaccination recorded · ${item.vaccine_type === 'rhino' ? 'Rhino' : 'Flu + tetanus'}`, detail: item.product_name || 'Product not specified' })),
      ...dewormingRecords.map((item) => ({ id: item.id, date: item.administered_on, title: 'Deworming recorded', detail: item.product_name || 'Product not specified' })),
      ...(farrierHistory.length ? farrierHistory.map((item) => ({ id: item.id, date: item.visit_date, title: 'Farrier visit recorded', detail: item.farrier_name || 'Farrier not specified' })) : selectedHorse.farrier_last_done ? [{ id: `farrier-${selectedHorse.id}`, date: selectedHorse.farrier_last_done, title: 'Farrier visit recorded', detail: selectedHorse.farrier_name || 'Farrier not specified' }] : []),
      ...(selectedHorse.stable_status === 'away' && selectedHorse.left_stable_at ? [{ id: `left-${selectedHorse.id}`, date: selectedHorse.left_stable_at, title: 'Left stable', detail: getMovementLabel(selectedHorse) }] : []),
      ...(selectedHorse.returned_stable_at ? [{ id: `returned-${selectedHorse.id}`, date: selectedHorse.returned_stable_at, title: 'Returned to stable', detail: 'Horse returned to stable.' }] : []),
    ].filter((item): item is { id: string; date: string; title: string; detail: string } => Boolean(item.date))
      .sort((a, b) => b.date.localeCompare(a.date))

    return (
      <section className={`${styles.panel} ${styles.profilePage}`}>
        <div className={`${styles.detailTopBar} ${styles.noPrint}`}>
          <button className={styles.backButton} onClick={closeHorse}>
            ← Back to horses
          </button>

          <div className={styles.profileIdentity}>
            <span className={styles.profileKicker}>Horse profile</span>
            <h1>{selectedHorse.name || 'Unnamed horse'}</h1>
            <div className={styles.profileFacts}>
              <span>{selectedHorse.horse_type || 'Type not set'}</span>
              <span>{getStableLocationLabel(selectedHorse)}</span>
              <span className={`${styles.profileStatus} ${getStatusClass(selectedHorse)}`}>
                {getStatusLabel(selectedHorse)}
              </span>
            </div>
          </div>

          <div className={styles.profileActions}>
            <button className={styles.profileAddButton} onClick={() => onVetQuickAction?.('Visits', selectedHorse.id)}>+ Add record</button>
            <button className={styles.printButton} onClick={() => router.push('/move')}>↔ Move horse</button>
            <button className={styles.primaryButton} onClick={() => router.push(`/horses/${selectedHorse.id}/edit`)}>Edit profile</button>
          </div>
        </div>

        <div className={styles.printSheet}>
          <div className={styles.printSheetHeader}>
            <h1>{selectedHorse.name || 'Unnamed horse'}</h1>
            <h2>{selectedHorse.horse_type || 'Horse'} · {getStableLocationLabel(selectedHorse)}</h2>
          </div>
          <table className={styles.printCareTable}><thead><tr><th>Care</th><th>Last done</th><th>Next due</th><th>Status</th></tr></thead><tbody>{careRows.map((row) => <tr key={row.id}><td>{row.label}</td><td>{formatDate(row.last)}</td><td>{formatDate(row.due)}</td><td>{getCareStatus(row.due).label}</td></tr>)}</tbody></table>
        </div>

        <section className={styles.careOverview}>
          <div className={styles.careHeading}><div><span className={styles.careEyebrow}>CARE FOLLOW-UP</span><h2>Care overview</h2><p>See what is due and record care without searching through separate screens.</p></div></div>
          <div className={styles.careTableWrap}>
            <table className={styles.careTable}>
              <thead><tr><th>Care</th><th>Last done</th><th>Next due</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {careRows.map((row) => {
                  const status = getCareStatus(row.due)
                  const isOpen = historyOpen[row.historyKey]
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td data-label="Care"><div className={styles.careName}>{row.label}</div><button type="button" className={styles.inlineHistory} onClick={() => row.id === 'farrier' ? void toggleFarrierHistory() : setHistoryOpen((current) => ({ ...current, [row.historyKey]: !current[row.historyKey] }))}>{isOpen ? 'Hide history' : 'View history'}</button></td>
                        <td data-label="Last done">{formatDate(row.last)}</td>
                        <td data-label="Next due">{formatDate(row.due)}</td>
                        <td data-label="Status"><span className={`${styles.careStatus} ${status.tone}`}><i />{status.label}</span></td>
                        <td data-label="Action"><button type="button" className={styles.rowAddButton} onClick={() => onVetQuickAction?.(row.menu, selectedHorse.id, row.vaccineType)}>Add record</button></td>
                      </tr>
                      {isOpen && <tr className={styles.historyExpanded}><td colSpan={5}>
                        {row.id === 'farrier' && farrierHistoryLoading ? <p>Loading history…</p> : row.history.length === 0 ? <p>No history yet.</p> : <div className={styles.activityList}>{row.history.map((item) => <div className={styles.activityItem} key={item.id}><span className={styles.activityDot} /><div><strong>{formatDate(item.date)}</strong><p>{item.detail}</p>{item.notes ? <small>{item.notes}</small> : null}{item.due ? <small>Next due: {formatDate(item.due)}</small> : null}</div></div>)}</div>}
                      </td></tr>}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
            {(vaccinationsLoading || dewormingLoading) && <div className={styles.careLoading}>Updating care records…</div>}
          </div>
        </section>

        {(selectedHorse.stable_status === 'away' || selectedHorse.returned_stable_at) && (
          <div className={styles.movementNotice}><strong>{selectedHorse.stable_status === 'away' ? 'Away from stable' : 'Last returned'}</strong><span>{selectedHorse.stable_status === 'away' ? `${formatDate(selectedHorse.left_stable_at)}${getMovementLabel(selectedHorse) !== '—' ? ` · ${getMovementLabel(selectedHorse)}` : ''}` : formatDate(selectedHorse.returned_stable_at)}</span></div>
        )}

        <div className={`${styles.quickActions} ${styles.noPrint}`}>
          <strong>Quick actions</strong>
          <button type="button" className={styles.quickPrimary} onClick={() => onVetQuickAction?.('Visits', selectedHorse.id)}>+ Log care</button>
          <button type="button" onClick={() => router.push('/move')}>↔ Move horse</button>
          <button type="button" onClick={() => { setNoteEditing(true); setNoteFeedback('') }}>＋ Add note</button>
        </div>

        <div className={styles.profileLowerGrid}>
          <section className={styles.profilePanel}>
            <div className={styles.profilePanelHeading}><div><span className={styles.panelIcon}>⌁</span><h3>Recent activity</h3></div>{recentActivity.length > 3 ? <button type="button" className={styles.textAction} onClick={() => setShowAllActivity((current) => !current)}>{showAllActivity ? 'Show less' : 'View all'}</button> : <span className={styles.subtleLabel}>Latest records</span>}</div>
            {recentActivity.length ? <div className={styles.activityList}>{(showAllActivity ? recentActivity : recentActivity.slice(0, 3)).map((item) => <div className={styles.activityItem} key={item.id}><span className={styles.activityDot} /><div><strong>{item.title}</strong><time>{formatDate(item.date)}</time><p>{item.detail}</p></div></div>)}</div> : <p className={styles.emptyActivity}>No care activity recorded yet.</p>}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.profilePanelHeading}><div><span className={styles.panelIcon}>♘</span><h3>Horse details</h3></div><button type="button" className={styles.textAction} onClick={() => router.push(`/horses/${selectedHorse.id}/edit`)}>Edit profile</button></div>
            <dl className={styles.detailFacts}>
              <div><dt>Type</dt><dd>{selectedHorse.horse_type || '—'}</dd></div>
              <div><dt>Location</dt><dd>{getStableLocationLabel(selectedHorse)}</dd></div>
              <div><dt>Status</dt><dd><span className={`${styles.profileStatus} ${getStatusClass(selectedHorse)}`}>{getStatusLabel(selectedHorse)}</span></dd></div>
              {selectedHorse.show_in_mare_cards && <><div><dt>Pregnant</dt><dd>{yesNo(selectedHorse.pregnant)}</dd></div><div><dt>Last in heat</dt><dd>{formatDate(selectedHorse.last_in_heat_date)}</dd></div>{selectedHorse.pregnancy_notes ? <div><dt>Breeding notes</dt><dd>{selectedHorse.pregnancy_notes}</dd></div> : null}</>}
              <div className={styles.notesFact}><dt>Notes</dt><dd>{noteEditing ? <div className={styles.noteEditor}><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} autoFocus /><div><button type="button" onClick={() => { setNoteEditing(false); setNoteDraft(selectedHorse.notes || '') }}>Cancel</button><button type="button" className={styles.quickPrimary} onClick={() => void saveHorseNote()} disabled={noteSaving}>{noteSaving ? 'Saving…' : 'Save note'}</button></div></div> : <button type="button" className={styles.noteValue} onClick={() => setNoteEditing(true)}>{selectedHorse.notes?.trim() || 'No notes yet'}</button>}{noteFeedback ? <small className={styles.noteFeedback}>{noteFeedback}</small> : null}</dd></div>
            </dl>
          </section>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>Stable horses</span>
          <h2>Horse List</h2>
          <p>Overview of all horses currently stored in Supabase.</p>
        </div>

        <div className={styles.countBox}>
          <span>Visible horses</span>
          <strong>{filteredHorses.length}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            placeholder="Search horse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <select
            className={styles.filter}
            value={activeFilter}
            onChange={(e) =>
              setActiveFilter(e.target.value as 'All' | 'Active' | 'Inactive')
            }
          >
            <option value="All">All horses</option>
            <option value="Active">Active only</option>
            <option value="Inactive">Inactive only</option>
          </select>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <div>Name</div>
          <div>Type</div>
          <div>Status</div>
          <div>Location</div>
          <div></div>
        </div>

        <div className={styles.tableBody}>
          {loading && <div className={styles.emptyState}>Loading horses...</div>}

          {!loading &&
            filteredHorses.map((horse) => (
              <div
                key={horse.id}
                className={styles.row}
                onClick={() => openHorse(horse)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openHorse(horse)
                  }
                }}
                aria-label={`Open details for ${horse.name}`}
              >
                <div className={styles.name}>{horse.name}</div>

                <div className={styles.tableMuted}>{horse.horse_type || '—'}</div>

                <div>
                  <span className={`${styles.statusPill} ${getStatusClass(horse)}`}>
                    {getStatusLabel(horse)}
                  </span>
                </div>

                <div className={styles.tableMuted}>{getStableLocationLabel(horse)}</div>

                <div className={styles.openCell}>
                  <span className={styles.rowActionArrow}>→</span>
                </div>
              </div>
            ))}

          {!loading && filteredHorses.length === 0 && (
            <div className={styles.emptyState}>No horses found.</div>
          )}
        </div>
      </div>
    </section>
  )
}
