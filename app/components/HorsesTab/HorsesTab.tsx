'use client'

import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
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
  horse_number: string | null
  registered_name: string | null
  ueln: string | null
  microchip: string | null
  registered_sex: string | null
  food_chain_status: string | null
  identification_status: string | null
  birth_date: string | null
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

type HorseEditValues = Pick<Horse, 'name' | 'registered_name' | 'horse_number' | 'horse_type' | 'notes' | 'ueln' | 'microchip' | 'registered_sex' | 'birth_date'>

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
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteEditing, setNoteEditing] = useState(false)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteFeedback, setNoteFeedback] = useState('')
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [archivingHorseId, setArchivingHorseId] = useState<string | null>(null)
  const [listFeedback, setListFeedback] = useState('')

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
          horse_number,
          registered_name,
          ueln,
          microchip,
          registered_sex,
          food_chain_status,
          identification_status,
          birth_date,
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
      const matchesSearch = [horse.name, horse.registered_name, horse.horse_number, horse.ueln, horse.microchip]
        .filter(Boolean)
        .join(' ')
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

  const openHorseEdit = (horse: Horse) => setEditingHorse(horse)

  const saveHorseEdits = async (horse: Horse, values: HorseEditValues) => {
    const { error } = await supabase.from('horses').update(values).eq('id', horse.id)
    if (error) {
      console.error('Error updating horse:', error)
      return 'Could not save the horse. Please try again.'
    }

    setHorses((current) => current.map((item) => item.id === horse.id ? { ...item, ...values } : item))
    setListFeedback(`${values.registered_name || values.name} was updated.`)
    setEditingHorse(null)
    return null
  }

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

  const getHorseDisplayName = (horse: Horse) => {
    const registeredName = horse.registered_name?.trim()
    if (registeredName) return registeredName

    const legacyName = (horse.name || '').replace(/^\d+\s*/, '').trim()
    if (legacyName && legacyName !== horse.name) return legacyName
    if (/^\d+$/.test((horse.name || '').trim())) return 'Name to confirm'
    return horse.name || 'Unnamed horse'
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

  const archiveHorse = async (horse: Horse) => {
    const name = getHorseDisplayName(horse)
    const confirmed = window.confirm(
      `Remove ${name} from the active horse list? Its care and medical history will be kept. You can find it again by selecting “Inactive only”.`
    )
    if (!confirmed) return

    setArchivingHorseId(horse.id)
    setListFeedback('')
    const { error } = await supabase
      .from('horses')
      .update({ active: false, stable_status: 'inactive' })
      .eq('id', horse.id)

    if (error) {
      console.error('Error archiving horse:', error)
      setListFeedback(`Could not remove ${name}. Please try again.`)
    } else {
      setHorses((current) => current.map((item) => item.id === horse.id
        ? { ...item, active: false, stable_status: 'inactive' }
        : item))
      if (selectedHorseId === horse.id) closeHorse()
      setListFeedback(`${name} was removed from the active list. Its history is preserved.`)
    }
    setArchivingHorseId(null)
  }

  const restoreHorse = async (horse: Horse) => {
    setArchivingHorseId(horse.id)
    setListFeedback('')
    const { error } = await supabase.from('horses').update({ active: true, stable_status: 'active' }).eq('id', horse.id)
    if (error) {
      console.error('Error restoring horse:', error)
      setListFeedback(`Could not restore ${getHorseDisplayName(horse)}. Please try again.`)
    } else {
      setHorses((current) => current.map((item) => item.id === horse.id ? { ...item, active: true, stable_status: 'active' } : item))
      setListFeedback(`${getHorseDisplayName(horse)} is active again.`)
    }
    setArchivingHorseId(null)
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
            <h1>{getHorseDisplayName(selectedHorse)}</h1>
            <div className={styles.identitySubline}>
              {selectedHorse.horse_number ? <span className={styles.numberBadge}>No. {selectedHorse.horse_number}</span> : null}
            </div>
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
            <button className={styles.printButton} onClick={() => router.push(`/move?horse=${encodeURIComponent(selectedHorse.id)}`)}>↔ Move horse</button>
            <button className={styles.primaryButton} onClick={() => openHorseEdit(selectedHorse)}>Edit horse</button>
            {selectedHorse.active === false ? <button type="button" className={styles.archiveButton} onClick={() => void restoreHorse(selectedHorse)} disabled={archivingHorseId === selectedHorse.id}>{archivingHorseId === selectedHorse.id ? 'Restoring…' : 'Restore horse'}</button> : <button type="button" className={styles.archiveButton} onClick={() => void archiveHorse(selectedHorse)} disabled={archivingHorseId === selectedHorse.id}>{archivingHorseId === selectedHorse.id ? 'Removing…' : 'Remove horse'}</button>}
          </div>
        </div>

        {listFeedback ? <div className={styles.listFeedback} role="status" aria-live="polite">{listFeedback}</div> : null}

        <div className={styles.printSheet}>
          <div className={styles.printSheetHeader}>
            <h1>{getHorseDisplayName(selectedHorse)}</h1>
            <h2>{selectedHorse.horse_number ? `No. ${selectedHorse.horse_number}` : ''}</h2>
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
          <button type="button" onClick={() => router.push(`/move?horse=${encodeURIComponent(selectedHorse.id)}`)}>↔ Move horse</button>
          <button type="button" onClick={() => { setNoteEditing(true); setNoteFeedback('') }}>＋ Add note</button>
        </div>

        <div className={styles.profileLowerGrid}>
          <section className={styles.profilePanel}>
            <div className={styles.profilePanelHeading}><div><span className={styles.panelIcon}>⌁</span><h3>Recent activity</h3></div>{recentActivity.length > 3 ? <button type="button" className={styles.textAction} onClick={() => setShowAllActivity((current) => !current)}>{showAllActivity ? 'Show less' : 'View all'}</button> : <span className={styles.subtleLabel}>Latest records</span>}</div>
            {recentActivity.length ? <div className={styles.activityList}>{(showAllActivity ? recentActivity : recentActivity.slice(0, 3)).map((item) => <div className={styles.activityItem} key={item.id}><span className={styles.activityDot} /><div><strong>{item.title}</strong><time>{formatDate(item.date)}</time><p>{item.detail}</p></div></div>)}</div> : <p className={styles.emptyActivity}>No care activity recorded yet.</p>}
          </section>

          <section className={styles.profilePanel}>
            <div className={styles.profilePanelHeading}><div><span className={styles.panelIcon}>♘</span><h3>Horse details</h3></div><button type="button" className={styles.textAction} onClick={() => openHorseEdit(selectedHorse)}>Edit horse</button></div>
            <dl className={styles.detailFacts}>
              <div><dt>Type</dt><dd>{selectedHorse.horse_type || '—'}</dd></div>
              <div><dt>Stable number</dt><dd>{selectedHorse.horse_number || '—'}</dd></div>
              <div><dt>Registered name</dt><dd>{selectedHorse.registered_name || '—'}</dd></div>
              <div><dt>UELN</dt><dd>{selectedHorse.ueln || '—'}</dd></div>
              <div><dt>Microchip</dt><dd>{selectedHorse.microchip || '—'}</dd></div>
              <div><dt>Registered sex</dt><dd>{selectedHorse.registered_sex || '—'}</dd></div>
              <div><dt>Date of birth</dt><dd>{formatDate(selectedHorse.birth_date)}</dd></div>
              <div><dt>Food chain</dt><dd>{selectedHorse.food_chain_status || '—'}</dd></div>
              <div><dt>Identification</dt><dd>{selectedHorse.identification_status || '—'}</dd></div>
              <div><dt>Location</dt><dd>{getStableLocationLabel(selectedHorse)}</dd></div>
              <div><dt>Status</dt><dd><span className={`${styles.profileStatus} ${getStatusClass(selectedHorse)}`}>{getStatusLabel(selectedHorse)}</span></dd></div>
              {selectedHorse.show_in_mare_cards && <><div><dt>Pregnant</dt><dd>{yesNo(selectedHorse.pregnant)}</dd></div><div><dt>Last in heat</dt><dd>{formatDate(selectedHorse.last_in_heat_date)}</dd></div>{selectedHorse.pregnancy_notes ? <div><dt>Breeding notes</dt><dd>{selectedHorse.pregnancy_notes}</dd></div> : null}</>}
              <div className={styles.notesFact}><dt>Notes</dt><dd>{noteEditing ? <div className={styles.noteEditor}><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={3} autoFocus /><div><button type="button" onClick={() => { setNoteEditing(false); setNoteDraft(selectedHorse.notes || '') }}>Cancel</button><button type="button" className={styles.quickPrimary} onClick={() => void saveHorseNote()} disabled={noteSaving}>{noteSaving ? 'Saving…' : 'Save note'}</button></div></div> : <button type="button" className={styles.noteValue} onClick={() => setNoteEditing(true)}>{selectedHorse.notes?.trim() || 'No notes yet'}</button>}{noteFeedback ? <small className={styles.noteFeedback}>{noteFeedback}</small> : null}</dd></div>
            </dl>
          </section>
        </div>
        {editingHorse ? <HorseEditDialog horse={editingHorse} onClose={() => setEditingHorse(null)} onSave={saveHorseEdits} /> : null}
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

      {listFeedback ? <div className={styles.listFeedback} role="status" aria-live="polite">{listFeedback}</div> : null}

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
          <div>Name / number</div>
          <div>Type</div>
          <div>Status</div>
          <div>Location</div>
          <div>Actions</div>
        </div>

        <div className={styles.tableBody}>
          {loading && <div className={styles.emptyState}>Loading horses...</div>}

          {!loading &&
            filteredHorses.map((horse) => (
              <div
                key={horse.id}
                className={styles.row}
              >
                <div className={styles.nameCell}>
                  <button type="button" className={styles.nameOpenButton} onClick={() => void openHorse(horse)} aria-label={`Open details for ${getHorseDisplayName(horse)}`}>{getHorseDisplayName(horse)}</button>
                  <div className={styles.nameMetadata}>
                    {horse.horse_number ? <span className={styles.numberBadge}>No. {horse.horse_number}</span> : null}
                  </div>
                </div>

                <div className={styles.tableMuted}>{horse.horse_type || '—'}</div>

                <div>
                  <span className={`${styles.statusPill} ${getStatusClass(horse)}`}>
                    {getStatusLabel(horse)}
                  </span>
                </div>

                <div className={styles.tableMuted}>{getStableLocationLabel(horse)}</div>

                <div className={styles.rowActions}>
                  <button type="button" className={styles.rowActionButton} onClick={() => openHorseEdit(horse)}>Edit</button>
                  <button type="button" className={styles.rowActionButton} onClick={() => router.push(`/move?horse=${encodeURIComponent(horse.id)}`)}>Move</button>
                  {horse.active === false ? <button type="button" className={styles.rowActionButton} onClick={() => void restoreHorse(horse)} disabled={archivingHorseId === horse.id}>{archivingHorseId === horse.id ? 'Restoring…' : 'Restore'}</button> : <button type="button" className={styles.rowRemoveButton} onClick={() => void archiveHorse(horse)} disabled={archivingHorseId === horse.id}>{archivingHorseId === horse.id ? 'Removing…' : 'Remove'}</button>}
                </div>
              </div>
            ))}

          {!loading && filteredHorses.length === 0 && (
            <div className={styles.emptyState}>No horses found.</div>
          )}
        </div>
      </div>
      {editingHorse ? <HorseEditDialog horse={editingHorse} onClose={() => setEditingHorse(null)} onSave={saveHorseEdits} /> : null}
    </section>
  )
}

function HorseEditDialog({
  horse,
  onClose,
  onSave,
}: {
  horse: Horse
  onClose: () => void
  onSave: (horse: Horse, values: HorseEditValues) => Promise<string | null>
}) {
  const initialName = horse.registered_name?.trim() || (/^\d+$/.test(horse.name.trim()) ? '' : horse.name)
  const [name, setName] = useState(initialName)
  const [number, setNumber] = useState(horse.horse_number || '')
  const [type, setType] = useState<HorseType | ''>(horse.horse_type || '')
  const [notes, setNotes] = useState(horse.notes || '')
  const [ueln, setUeln] = useState(horse.ueln || '')
  const [microchip, setMicrochip] = useState(horse.microchip || '')
  const [registeredSex, setRegisteredSex] = useState(horse.registered_sex || '')
  const [birthDate, setBirthDate] = useState(horse.birth_date?.slice(0, 10) || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Enter the horse’s official name.')
      return
    }
    setSaving(true)
    setError('')
    const result = await onSave(horse, {
      name: name.trim(),
      registered_name: name.trim(),
      horse_number: number.trim() || null,
      horse_type: type || null,
      notes: notes.trim() || null,
      ueln: ueln.trim() || null,
      microchip: microchip.trim() || null,
      registered_sex: registeredSex.trim() || null,
      birth_date: birthDate || null,
    })
    if (result) setError(result)
    setSaving(false)
  }

  return (
    <div className={styles.editOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section className={styles.editDialog} role="dialog" aria-modal="true" aria-labelledby="horse-edit-title">
        <div className={styles.editDialogHeader}>
          <div><span className={styles.kicker}>Horse details</span><h2 id="horse-edit-title">Edit horse</h2><p>Change the main details here. Use Move to record a new location.</p></div>
          <button type="button" className={styles.editCloseButton} aria-label="Close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <div className={styles.editFormGrid}>
            <label className={styles.editField}>Official horse name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required /></label>
            <label className={styles.editField}>Horse number<input value={number} onChange={(event) => setNumber(event.target.value)} maxLength={32} /></label>
            <label className={styles.editField}>Type<select value={type} onChange={(event) => setType(event.target.value as HorseType | '')}><option value="">Choose type</option>{(['Sport horse', 'Young horse', 'Foal', 'Mare', 'Mare with foal'] as HorseType[]).map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
            <label className={`${styles.editField} ${styles.editNotes}`}>Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={5000} /></label>
          </div>
          <details className={styles.editExtra}><summary>Identification details</summary><div className={styles.editFormGrid}><label className={styles.editField}>UELN<input value={ueln} onChange={(event) => setUeln(event.target.value)} maxLength={64} /></label><label className={styles.editField}>Microchip<input value={microchip} onChange={(event) => setMicrochip(event.target.value)} maxLength={64} /></label><label className={styles.editField}>Registered sex<input value={registeredSex} onChange={(event) => setRegisteredSex(event.target.value)} maxLength={40} /></label><label className={styles.editField}>Date of birth<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label></div></details>
          {error ? <p className={styles.editError} role="alert">{error}</p> : null}
          <div className={styles.editDialogActions}><button type="button" className={styles.rowActionButton} onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className={styles.quickPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </section>
    </div>
  )
}
