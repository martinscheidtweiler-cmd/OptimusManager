'use client'

import { useEffect, useMemo, useState } from 'react'
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

type HorseForm = {
  name: string
  horse_type: '' | HorseType
  stable_status: StableStatus
  left_stable_at: string
  returned_stable_at: string
  moved_to_location: string
  moved_to_detail: string
  farrier_name: string
  farrier_last_done: string
  farrier_interval_weeks: string
  stable_location: '' | StableLocation
  box_number: string
  pasture_name: string
  show_in_rider_planning: boolean
  show_in_mare_cards: boolean
  show_in_tasks: boolean
  last_in_heat_date: string
  pregnant: 'unknown' | 'yes' | 'no'
  pregnancy_notes: string
  notes: string
  active: boolean
}

const HORSE_TYPES: HorseType[] = [
  'Sport horse',
  'Young horse',
  'Foal',
  'Mare',
  'Mare with foal'
]

const FARRIERS = ['Maarten', 'Niels', 'Tom', 'Seppe']

const STABLE_LOCATIONS: StableLocation[] = [
  '47B',
  '47B Big Box',
  '50',
  'Oostm',
  'Serre',
  'Vremde'
]

function locationNeedsBox(location: string) {
  return ['47B', '47B Big Box', '50', 'Serre'].includes(location)
}

function locationUsesMixedSetup(location: string) {
  return location === 'Oostm'
}

function locationUsesPasture(location: string) {
  return ['Vremde'].includes(location)
}

export default function HorsesTab() {
  const [horses, setHorses] = useState<Horse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'All' | 'Active' | 'Inactive'>('Active')
  const [selectedHorseId, setSelectedHorseId] = useState<string | null>(null)
  const [form, setForm] = useState<HorseForm | null>(null)

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
      const matchesSearch = horse.name.toLowerCase().includes(search.toLowerCase())

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

  const nextFarrierDate = useMemo(() => {
    if (!form?.farrier_last_done) return '—'
    const weeks = Number(form.farrier_interval_weeks || 0)
    if (!weeks) return '—'

    const base = new Date(form.farrier_last_done)
    if (Number.isNaN(base.getTime())) return '—'

    base.setDate(base.getDate() + weeks * 7)
    return base.toLocaleDateString('nl-BE')
  }, [form])

  const openHorse = (horse: Horse) => {
    setSelectedHorseId(horse.id)
    setForm({
      name: horse.name || '',
      horse_type: horse.horse_type || '',
      stable_status: horse.stable_status || (horse.active === false ? 'inactive' : 'active'),
      left_stable_at: horse.left_stable_at ? horse.left_stable_at.slice(0, 16) : '',
      returned_stable_at: horse.returned_stable_at ? horse.returned_stable_at.slice(0, 16) : '',
      moved_to_location: horse.moved_to_location || '',
      moved_to_detail: horse.moved_to_detail || '',
      farrier_name: horse.farrier_name || '',
      farrier_last_done: horse.farrier_last_done || '',
      farrier_interval_weeks: horse.farrier_interval_weeks
        ? String(horse.farrier_interval_weeks)
        : '6',
      stable_location: horse.stable_location || '',
      box_number: horse.box_number || '',
      pasture_name: horse.pasture_name || '',
      show_in_rider_planning: horse.show_in_rider_planning === true,
      show_in_mare_cards: horse.show_in_mare_cards === true,
      show_in_tasks: horse.show_in_tasks === true,
      last_in_heat_date: horse.last_in_heat_date || '',
      pregnant:
        horse.pregnant === true ? 'yes' : horse.pregnant === false ? 'no' : 'unknown',
      pregnancy_notes: horse.pregnancy_notes || '',
      notes: horse.notes || '',
      active: horse.active !== false
    })
  }

  const closeHorse = async () => {
    setSelectedHorseId(null)
    setForm(null)
    await loadHorses()
  }

  const updateField = <K extends keyof HorseForm>(key: K, value: HorseForm[K]) => {
    setForm((prev) => {
      if (!prev) return prev

      const next = { ...prev, [key]: value }

      if (key === 'stable_location') {
        const newLocation = String(value)

        if (!locationNeedsBox(newLocation) && !locationUsesMixedSetup(newLocation)) {
          next.box_number = ''
        }

        if (!locationUsesPasture(newLocation) && !locationUsesMixedSetup(newLocation)) {
          next.pasture_name = ''
        }
      }

      if (key === 'show_in_mare_cards' && value === false) {
        next.last_in_heat_date = ''
        next.pregnant = 'unknown'
        next.pregnancy_notes = ''
      }

      return next
    })
  }

  const saveHorse = async () => {
    if (!selectedHorseId || !form) return

    setSaving(true)

    const payload = {
      name: form.name || null,
      horse_type: form.horse_type || null,
      stable_status: form.stable_status,
      left_stable_at: form.left_stable_at || null,
      returned_stable_at: form.returned_stable_at || null,
      moved_to_location: form.moved_to_location || null,
      moved_to_detail: form.moved_to_detail || null,
      farrier_name: form.farrier_name || null,
      farrier_last_done: form.farrier_last_done || null,
      farrier_interval_weeks: form.farrier_interval_weeks
        ? Number(form.farrier_interval_weeks)
        : 6,
      stable_location: form.stable_location || null,
      box_number: form.box_number || null,
      pasture_name: form.pasture_name || null,
      show_in_rider_planning: form.show_in_rider_planning,
      show_in_mare_cards: form.show_in_mare_cards,
      show_in_tasks: form.show_in_tasks,
      last_in_heat_date: form.show_in_mare_cards ? form.last_in_heat_date || null : null,
      pregnant:
        form.show_in_mare_cards
          ? form.pregnant === 'yes'
            ? true
            : form.pregnant === 'no'
              ? false
              : null
          : null,
      pregnancy_notes: form.show_in_mare_cards ? form.pregnancy_notes || null : null,
      notes: form.notes || null,
      active: form.active
    }

    const { error } = await supabase
      .from('horses')
      .update(payload)
      .eq('id', selectedHorseId)

    if (error) {
      console.error('Error saving horse:', error)
      alert('Opslaan mislukt')
      setSaving(false)
      return
    }

    setSaving(false)
    await loadHorses()
    alert('Paard opgeslagen')
  }

  const markLeftStable = () => {
    if (!form) return
    const now = new Date().toISOString()

    setForm({
      ...form,
      stable_status: 'away',
      left_stable_at: now.slice(0, 16),
      active: true
    })
  }

  const markReturnedStable = () => {
    if (!form) return
    const now = new Date().toISOString()

    setForm({
      ...form,
      stable_status: 'active',
      returned_stable_at: now.slice(0, 16),
      active: true
    })
  }

  const markInactive = () => {
    if (!form) return

    setForm({
      ...form,
      stable_status: 'inactive',
      active: false
    })
  }

  if (selectedHorseId && form && selectedHorse) {
    const showBoxField =
      locationNeedsBox(form.stable_location) || locationUsesMixedSetup(form.stable_location)
    const showPastureField =
      locationUsesPasture(form.stable_location) || locationUsesMixedSetup(form.stable_location)

    return (
      <section className={styles.panel}>
        <div className={styles.detailTopBar}>
          <button className={styles.backButton} onClick={closeHorse}>
            ← Back to horses
          </button>

          <div className={styles.detailActions}>
            <button className={styles.secondaryButton} onClick={markLeftStable}>
              Left stable
            </button>
            <button className={styles.secondaryButton} onClick={markReturnedStable}>
              Returned
            </button>
            <button className={styles.secondaryButton} onClick={markInactive}>
              Set inactive
            </button>
            <button className={styles.primaryButton} onClick={saveHorse} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className={styles.header}>
          <div>
            <span className={styles.kicker}>Horse detail</span>
            <h2>{selectedHorse.name}</h2>
            <p>Manage this horse inside the same tab.</p>
          </div>

          <div className={styles.countBox}>
            <span>Status</span>
            <strong>
              {form.stable_status === 'active'
                ? 'Active'
                : form.stable_status === 'away'
                  ? 'Away'
                  : 'Inactive'}
            </strong>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Basic info</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Name</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Type</label>
                <select
                  className={styles.input}
                  value={form.horse_type}
                  onChange={(e) =>
                    updateField('horse_type', e.target.value as HorseForm['horse_type'])
                  }
                >
                  <option value="">Select type</option>
                  {HORSE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Stable status</label>
                <select
                  className={styles.input}
                  value={form.stable_status}
                  onChange={(e) =>
                    updateField(
                      'stable_status',
                      e.target.value as 'active' | 'away' | 'inactive'
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="away">Away</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>Active in list</label>
                <select
                  className={styles.input}
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => updateField('active', e.target.value === 'true')}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Stable location</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Location</label>
                <select
                  className={styles.input}
                  value={form.stable_location}
                  onChange={(e) =>
                    updateField('stable_location', e.target.value as HorseForm['stable_location'])
                  }
                >
                  <option value="">Select location</option>
                  {STABLE_LOCATIONS.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </div>

              {showBoxField && (
                <div className={styles.field}>
                  <label>Box</label>
                  <input
                    className={styles.input}
                    value={form.box_number}
                    onChange={(e) => updateField('box_number', e.target.value)}
                    placeholder="Box number"
                  />
                </div>
              )}

              {showPastureField && (
                <div className={styles.field}>
                  <label>Weide</label>
                  <input
                    className={styles.input}
                    value={form.pasture_name}
                    onChange={(e) => updateField('pasture_name', e.target.value)}
                    placeholder="Weide naam of nummer"
                  />
                </div>
              )}
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Stable movement</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Left stable at</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.left_stable_at}
                  onChange={(e) => updateField('left_stable_at', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Returned at</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.returned_stable_at}
                  onChange={(e) => updateField('returned_stable_at', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Where to</label>
                <input
                  className={styles.input}
                  value={form.moved_to_location}
                  onChange={(e) => updateField('moved_to_location', e.target.value)}
                  placeholder="Azelhof, clinic, other stable..."
                />
              </div>

              <div className={styles.field}>
                <label>Extra detail</label>
                <input
                  className={styles.input}
                  value={form.moved_to_detail}
                  onChange={(e) => updateField('moved_to_detail', e.target.value)}
                  placeholder="Reason or exact place"
                />
              </div>
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Farrier</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Farrier</label>
                <select
                  className={styles.input}
                  value={form.farrier_name}
                  onChange={(e) => updateField('farrier_name', e.target.value)}
                >
                  <option value="">Select farrier</option>
                  {FARRIERS.map((farrier) => (
                    <option key={farrier} value={farrier}>
                      {farrier}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Last done</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.farrier_last_done}
                  onChange={(e) => updateField('farrier_last_done', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Interval weeks</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.farrier_interval_weeks}
                  onChange={(e) => updateField('farrier_interval_weeks', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label>Next farrier</label>
                <div className={styles.readonlyBox}>{nextFarrierDate}</div>
              </div>
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Visibility</h3>

            <div className={styles.toggleGrid}>
              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_rider_planning}
                  onChange={(e) => updateField('show_in_rider_planning', e.target.checked)}
                />
                <div>
                  <strong>Rider planning</strong>
                  <span>Show this horse in the rider planner</span>
                </div>
              </label>

              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_mare_cards}
                  onChange={(e) => updateField('show_in_mare_cards', e.target.checked)}
                />
                <div>
                  <strong>Mare cards</strong>
                  <span>Show this horse in mare follow-up</span>
                </div>
              </label>

              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_tasks}
                  onChange={(e) => updateField('show_in_tasks', e.target.checked)}
                />
                <div>
                  <strong>Tasks</strong>
                  <span>Show this horse in task flows</span>
                </div>
              </label>
            </div>
          </div>

          {form.show_in_mare_cards && (
            <div className={styles.detailCard}>
              <h3 className={styles.cardTitle}>Mare card</h3>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label>Last in heat</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={form.last_in_heat_date}
                    onChange={(e) => updateField('last_in_heat_date', e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label>Pregnant</label>
                  <select
                    className={styles.input}
                    value={form.pregnant}
                    onChange={(e) =>
                      updateField('pregnant', e.target.value as HorseForm['pregnant'])
                    }
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className={`${styles.field} ${styles.fullField}`}>
                  <label>Pregnancy notes</label>
                  <textarea
                    className={styles.textarea}
                    rows={5}
                    value={form.pregnancy_notes}
                    onChange={(e) => updateField('pregnancy_notes', e.target.value)}
                    placeholder="Embryo, scan result, stallion, due date..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.detailCard} ${styles.fullWidth}`}>
            <h3 className={styles.cardTitle}>Notes</h3>

            <div className={styles.field}>
              <label>Notes</label>
              <textarea
                className={styles.textarea}
                rows={8}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
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
          <div>Status</div>
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

                <div>
                  {horse.active !== false ? (
                    <span className={styles.activeTag}>Active</span>
                  ) : (
                    <span className={styles.inactiveTag}>Inactive</span>
                  )}
                </div>

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