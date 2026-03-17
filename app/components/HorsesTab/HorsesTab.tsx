'use client'

import { useEffect, useMemo, useState } from 'react'
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

export default function HorsesTab() {
  const router = useRouter()

  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Inactive'>('Active')
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)

  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [vaccinationsLoading, setVaccinationsLoading] = useState(false)

  const [dewormingRecords, setDewormingRecords] = useState<DewormingRecord[]>([])
  const [dewormingLoading, setDewormingLoading] = useState(false)

  const [historyOpen, setHistoryOpen] = useState<{
    flu_tetanus: boolean
    rhino: boolean
    deworming: boolean
  }>({
    flu_tetanus: false,
    rhino: false,
    deworming: false,
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
        console.error('Error loading horses:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
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
        console.error('Error loading vaccinations:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
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
        console.error('Error loading deworming:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        })
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
    setHistoryOpen({
      flu_tetanus: false,
      rhino: false,
      deworming: false,
    })

    await Promise.all([loadVaccinations(horse.id), loadDeworming(horse.id)])
  }

  const closeHorse = () => {
    setSelectedHorseId(null)
    setVaccinations([])
    setDewormingRecords([])
    setHistoryOpen({
      flu_tetanus: false,
      rhino: false,
      deworming: false,
    })
  }

  const handlePrint = () => {
    window.print()
  }

  const formatDate = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('nl-BE')
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

  const getNextFarrierDate = (horse: Horse) => {
    if (!horse.farrier_last_done || !horse.farrier_interval_weeks) return '—'

    const base = new Date(horse.farrier_last_done)
    if (Number.isNaN(base.getTime())) return '—'

    base.setDate(base.getDate() + horse.farrier_interval_weeks * 7)
    return base.toLocaleDateString('nl-BE')
  }

  const yesNo = (value: boolean | null) => {
    if (value === true) return 'Yes'
    if (value === false) return 'No'
    return '—'
  }

  if (selectedHorse) {
    return (
      <section className={styles.panel}>
        <div className={`${styles.detailTopBar} ${styles.noPrint}`}>
          <button className={styles.backButton} onClick={closeHorse}>
            ← Back to horses
          </button>

          <button className={styles.printButton} onClick={handlePrint}>
            Print
          </button>

          <button
            className={styles.primaryButton}
            onClick={() => router.push(`/horses/${selectedHorse.id}/edit`)}
          >
            Edit horse
          </button>
        </div>

        <div className={styles.printSheet}>
          <div className={styles.printSheetHeader}>
            <h1>{selectedHorse.name || 'Unnamed horse'}</h1>
            <h2>Verkoopfiche</h2>
          </div>

          <div className={styles.printSheetGrid}>
            <div className={styles.printSheetItem}>
              <span>Laatste griep + tetanus</span>
              <strong>{latestFlu ? formatDate(latestFlu.administered_on) : '—'}</strong>
              <small>{latestFlu?.product_name || '—'}</small>
            </div>

            <div className={styles.printSheetItem}>
              <span>Laatste rhino</span>
              <strong>{latestRhino ? formatDate(latestRhino.administered_on) : '—'}</strong>
              <small>{latestRhino?.product_name || '—'}</small>
            </div>

            <div className={styles.printSheetItem}>
              <span>Laatst naar de smid</span>
              <strong>{formatDate(selectedHorse.farrier_last_done)}</strong>
              <small>{selectedHorse.farrier_name || '—'}</small>
            </div>

            <div className={styles.printSheetItem}>
              <span>Laatste ontworming</span>
              <strong>{latestDeworming ? formatDate(latestDeworming.administered_on) : '—'}</strong>
              <small>{latestDeworming?.product_name || '—'}</small>
            </div>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={`${styles.detailCard} ${styles.heroCard} ${styles.noPrint}`}>
            <div className={styles.heroTop}>
              <div>
                <span className={styles.heroKicker}>Horse detail</span>
                <h3 className={styles.heroName}>{selectedHorse.name || 'Unnamed horse'}</h3>
                <p className={styles.heroSubline}>
                  {selectedHorse.horse_type || '—'} · {getStableLocationLabel(selectedHorse)}
                </p>
              </div>

              <div className={styles.heroRight}>
                <div className={styles.heroStatusBox}>
                  <span className={styles.heroStatusLabel}>Status</span>
                  <span className={`${styles.statusPill} ${getStatusClass(selectedHorse)}`}>
                    {getStatusLabel(selectedHorse)}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.heroFlags}>
              <span
                className={`${styles.miniFlag} ${
                  selectedHorse.show_in_rider_planning ? styles.flagOn : styles.flagOff
                }`}
              >
                Rider planning
              </span>
              <span
                className={`${styles.miniFlag} ${
                  selectedHorse.show_in_mare_cards ? styles.flagOn : styles.flagOff
                }`}
              >
                Mare cards
              </span>
              <span
                className={`${styles.miniFlag} ${
                  selectedHorse.show_in_tasks ? styles.flagOn : styles.flagOff
                }`}
              >
                Tasks
              </span>
            </div>
          </div>

          <div className={`${styles.detailCard} ${styles.noPrint}`}>
            <h3 className={styles.cardTitle}>Basic information</h3>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span>Type</span>
                <strong>{selectedHorse.horse_type || '—'}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Stable location</span>
                <strong>{getStableLocationLabel(selectedHorse)}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Stable status</span>
                <strong>{getStatusLabel(selectedHorse)}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Left stable</span>
                <strong>{formatDate(selectedHorse.left_stable_at)}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Returned</span>
                <strong>{formatDate(selectedHorse.returned_stable_at)}</strong>
              </div>

              <div className={`${styles.infoItem} ${styles.fullSpan}`}>
                <span>Where to</span>
                <strong>{getMovementLabel(selectedHorse)}</strong>
              </div>
            </div>
          </div>

          <div className={`${styles.detailCard} ${styles.noPrint}`}>
            <h3 className={styles.cardTitle}>Vaccinations</h3>

            {vaccinationsLoading ? (
              <div className={styles.notesBox}>Loading vaccinations...</div>
            ) : (
              <div className={styles.vaccinationWrap}>
                <div className={styles.vaccineBlock}>
                  <div className={styles.vaccineTop}>
                    <div>
                      <span className={styles.vaccineLabel}>Griep + Tetanus</span>
                      <strong className={styles.vaccineDate}>
                        {latestFlu ? formatDate(latestFlu.administered_on) : '—'}
                      </strong>
                      <span className={styles.vaccineMeta}>
                        Vervaldatum: {latestFlu ? formatDate(latestFlu.next_due_on) : '—'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.historyToggle}
                      onClick={() =>
                        setHistoryOpen((prev) => ({
                          ...prev,
                          flu_tetanus: !prev.flu_tetanus,
                        }))
                      }
                    >
                      {historyOpen.flu_tetanus ? 'Historiek sluiten' : 'Historiek openen'}
                    </button>
                  </div>

                  {historyOpen.flu_tetanus && (
                    <div className={styles.historyList}>
                      {fluVaccinations.length === 0 ? (
                        <div className={styles.historyEmpty}>Geen historiek.</div>
                      ) : (
                        fluVaccinations.map((item) => (
                          <div key={item.id} className={styles.historyRow}>
                            <div className={styles.historyDate}>
                              <strong>{formatDate(item.administered_on)}</strong>
                              <span>Due: {formatDate(item.next_due_on)}</span>
                            </div>

                            <div className={styles.historyContent}>
                              <div className={styles.historyProduct}>
                                {item.product_name || 'Geen product ingevuld'}
                              </div>
                              <div className={styles.historyNote}>
                                {item.notes?.trim() || '—'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className={styles.vaccineBlock}>
                  <div className={styles.vaccineTop}>
                    <div>
                      <span className={styles.vaccineLabel}>Rhino</span>
                      <strong className={styles.vaccineDate}>
                        {latestRhino ? formatDate(latestRhino.administered_on) : '—'}
                      </strong>
                      <span className={styles.vaccineMeta}>
                        Vervaldatum: {latestRhino ? formatDate(latestRhino.next_due_on) : '—'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.historyToggle}
                      onClick={() =>
                        setHistoryOpen((prev) => ({
                          ...prev,
                          rhino: !prev.rhino,
                        }))
                      }
                    >
                      {historyOpen.rhino ? 'Historiek sluiten' : 'Historiek openen'}
                    </button>
                  </div>

                  {historyOpen.rhino && (
                    <div className={styles.historyList}>
                      {rhinoVaccinations.length === 0 ? (
                        <div className={styles.historyEmpty}>Geen historiek.</div>
                      ) : (
                        rhinoVaccinations.map((item) => (
                          <div key={item.id} className={styles.historyRow}>
                            <div className={styles.historyDate}>
                              <strong>{formatDate(item.administered_on)}</strong>
                              <span>Due: {formatDate(item.next_due_on)}</span>
                            </div>

                            <div className={styles.historyContent}>
                              <div className={styles.historyProduct}>
                                {item.product_name || 'Geen product ingevuld'}
                              </div>
                              <div className={styles.historyNote}>
                                {item.notes?.trim() || '—'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`${styles.detailCard} ${styles.noPrint}`}>
            <h3 className={styles.cardTitle}>Ontworming</h3>

            {dewormingLoading ? (
              <div className={styles.notesBox}>Loading deworming...</div>
            ) : (
              <div className={styles.vaccinationWrap}>
                <div className={styles.vaccineBlock}>
                  <div className={styles.vaccineTop}>
                    <div>
                      <span className={styles.vaccineLabel}>Laatste ontworming</span>
                      <strong className={styles.vaccineDate}>
                        {latestDeworming ? formatDate(latestDeworming.administered_on) : '—'}
                      </strong>
                      <span className={styles.vaccineMeta}>
                        Vervaldatum: {latestDeworming ? formatDate(latestDeworming.next_due_on) : '—'}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.historyToggle}
                      onClick={() =>
                        setHistoryOpen((prev) => ({
                          ...prev,
                          deworming: !prev.deworming,
                        }))
                      }
                    >
                      {historyOpen.deworming ? 'Historiek sluiten' : 'Historiek openen'}
                    </button>
                  </div>

                  {historyOpen.deworming && (
                    <div className={styles.historyList}>
                      {dewormingRecords.length === 0 ? (
                        <div className={styles.historyEmpty}>Geen historiek.</div>
                      ) : (
                        dewormingRecords.map((item) => (
                          <div key={item.id} className={styles.historyRow}>
                            <div className={styles.historyDate}>
                              <strong>{formatDate(item.administered_on)}</strong>
                              <span>Due: {formatDate(item.next_due_on)}</span>
                            </div>

                            <div className={styles.historyContent}>
                              <div className={styles.historyProduct}>
                                {item.product_name || 'Geen product ingevuld'}
                              </div>
                              <div className={styles.historyNote}>
                                {item.notes?.trim() || '—'}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={`${styles.detailCard} ${styles.noPrint}`}>
            <h3 className={styles.cardTitle}>Farrier</h3>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span>Farrier</span>
                <strong>{selectedHorse.farrier_name || '—'}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Last done</span>
                <strong>{formatDate(selectedHorse.farrier_last_done)}</strong>
              </div>

              <div className={styles.infoItem}>
                <span>Interval</span>
                <strong>
                  {selectedHorse.farrier_interval_weeks
                    ? `${selectedHorse.farrier_interval_weeks} weeks`
                    : '—'}
                </strong>
              </div>

              <div className={styles.infoItem}>
                <span>Next farrier</span>
                <strong>{getNextFarrierDate(selectedHorse)}</strong>
              </div>
            </div>
          </div>

          {selectedHorse.show_in_mare_cards && (
            <div className={`${styles.detailCard} ${styles.noPrint}`}>
              <h3 className={styles.cardTitle}>Mare card</h3>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span>Last in heat</span>
                  <strong>{formatDate(selectedHorse.last_in_heat_date)}</strong>
                </div>

                <div className={styles.infoItem}>
                  <span>Pregnant</span>
                  <strong>{yesNo(selectedHorse.pregnant)}</strong>
                </div>

                <div className={`${styles.infoItem} ${styles.fullSpan}`}>
                  <span>Pregnancy notes</span>
                  <strong>{selectedHorse.pregnancy_notes || '—'}</strong>
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.detailCard} ${styles.fullWidth} ${styles.noPrint}`}>
            <h3 className={styles.cardTitle}>Notes</h3>
            <div className={styles.notesBox}>
              {selectedHorse.notes?.trim() ? selectedHorse.notes : 'No notes yet.'}
            </div>
          </div>
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