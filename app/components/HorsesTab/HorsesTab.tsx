'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import styles from './HorsesTab.module.css'

type HorseType = 'Sport horse' | 'Young horse' | 'Foal' | 'Mare' | 'Mare with foal'
type StableStatus = 'active' | 'away' | 'inactive'
type StableLocation = '47B' | '47B Big Box' | '50' | 'Oostm' | 'Serre' | 'Vremde'

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

export default function HorsesTab() {
  const router = useRouter()

  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Inactive'>('Active')
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)

  const loadHorses = async () => {
    setLoading(true)

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
    } else {
      setHorses((data || []) as Horse[])
    }

    setLoading(false)
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

  const openHorse = (horse: Horse) => {
    setSelectedHorseId(horse.id)
  }

  const closeHorse = () => {
    setSelectedHorseId(null)
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
        <div className={styles.detailTopBar}>
          <button className={styles.backButton} onClick={closeHorse}>
            ← Back to horses
          </button>

          <button
            className={styles.primaryButton}
            onClick={() => router.push(`/horses/${selectedHorse.id}/edit`)}
          >
            Edit horse
          </button>
        </div>

        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>Horse detail</span>
            <h2>{selectedHorse.name || 'Unnamed horse'}</h2>
            <p>Basic card with the most important stable information.</p>
          </div>

          <div className={styles.countBox}>
            <span>Status</span>
            <strong>{getStatusLabel(selectedHorse)}</strong>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={`${styles.detailCard} ${styles.heroCard}`}>
            <div className={styles.heroTop}>
              <div>
                <h3 className={styles.heroName}>{selectedHorse.name || 'Unnamed horse'}</h3>
                <p className={styles.heroSubline}>
                  {selectedHorse.horse_type || '—'} · {getStableLocationLabel(selectedHorse)}
                </p>
              </div>

              <span className={`${styles.statusPill} ${getStatusClass(selectedHorse)}`}>
                {getStatusLabel(selectedHorse)}
              </span>
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

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Basic info</h3>

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
                <span>Active in list</span>
                <strong>{selectedHorse.active === false ? 'No' : 'Yes'}</strong>
              </div>
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Stable movement</h3>

            <div className={styles.infoGrid}>
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

          <div className={styles.detailCard}>
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
            <div className={styles.detailCard}>
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

          <div className={`${styles.detailCard} ${styles.fullWidth}`}>
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