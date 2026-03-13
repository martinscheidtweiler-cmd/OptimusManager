'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabaseClient'
import styles from './editHorse.module.css'

type HorseType = 'Sport horse' | 'Young horse' | 'Foal' | 'Mare' | 'Mare with foal'
type StableStatus = 'active' | 'away' | 'inactive'
type StableLocation = '47B' | '47B Big Box' | '50' | 'Oostm' | 'Serre' | 'Vremde'

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
  return location === 'Vremde'
}

export default function EditHorsePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<HorseForm | null>(null)

  useEffect(() => {
    const loadHorse = async () => {
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
        .eq('id', id)
        .single()

      if (error || !data) {
        console.error(error)
        setLoading(false)
        return
      }

      setForm({
        name: data.name || '',
        horse_type: data.horse_type || '',
        stable_status: data.stable_status || (data.active === false ? 'inactive' : 'active'),
        left_stable_at: data.left_stable_at ? data.left_stable_at.slice(0, 16) : '',
        returned_stable_at: data.returned_stable_at ? data.returned_stable_at.slice(0, 16) : '',
        moved_to_location: data.moved_to_location || '',
        moved_to_detail: data.moved_to_detail || '',
        farrier_name: data.farrier_name || '',
        farrier_last_done: data.farrier_last_done || '',
        farrier_interval_weeks: data.farrier_interval_weeks
          ? String(data.farrier_interval_weeks)
          : '6',
        stable_location: data.stable_location || '',
        box_number: data.box_number || '',
        pasture_name: data.pasture_name || '',
        show_in_rider_planning: data.show_in_rider_planning === true,
        show_in_mare_cards: data.show_in_mare_cards === true,
        show_in_tasks: data.show_in_tasks === true,
        last_in_heat_date: data.last_in_heat_date || '',
        pregnant:
          data.pregnant === true ? 'yes' : data.pregnant === false ? 'no' : 'unknown',
        pregnancy_notes: data.pregnancy_notes || '',
        notes: data.notes || '',
        active: data.active !== false
      })

      setLoading(false)
    }

    loadHorse()
  }, [id])

  const updateField = <K extends keyof HorseForm>(key: K, value: HorseForm[K]) => {
    setForm((prev) => {
      if (!prev) return prev

      const next = { ...prev, [key]: value }

      if (key === 'stable_location') {
        const location = String(value)

        if (!locationNeedsBox(location) && !locationUsesMixedSetup(location)) {
          next.box_number = ''
        }

        if (!locationUsesPasture(location) && !locationUsesMixedSetup(location)) {
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
    if (!form) return

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
      .eq('id', id)

    if (error) {
      console.error(error)
      alert('Opslaan mislukt')
      setSaving(false)
      return
    }

    setSaving(false)
    router.push('/')
  }

  if (loading) return <div className={styles.loading}>Loading...</div>
  if (!form) return <div className={styles.notFound}>Horse not found.</div>

  const showBoxField =
    locationNeedsBox(form.stable_location) || locationUsesMixedSetup(form.stable_location)

  const showPastureField =
    locationUsesPasture(form.stable_location) || locationUsesMixedSetup(form.stable_location)

  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.backButton} onClick={() => router.back()}>
              Back
            </button>
          </div>

          <button className={styles.primaryButton} onClick={saveHorse} disabled={saving}>
            {saving ? 'Saving...' : 'Save horse'}
          </button>
        </div>

        <div className={styles.heroCard}>
          <span className={styles.kicker}>Horse edit</span>
          <h1 className={styles.title}>{form.name || 'Unnamed horse'}</h1>
          <p className={styles.subtitle}>
            Edit the basic stable information for this horse.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Basic info</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Name</label>
                <input
                  className={styles.input}
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Type</label>
                <select
                  className={styles.select}
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
                <label className={styles.label}>Stable status</label>
                <select
                  className={styles.select}
                  value={form.stable_status}
                  onChange={(e) =>
                    updateField('stable_status', e.target.value as StableStatus)
                  }
                >
                  <option value="active">Active</option>
                  <option value="away">Away</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Active in list</label>
                <select
                  className={styles.select}
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => updateField('active', e.target.value === 'true')}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Stable location</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Location</label>
                <select
                  className={styles.select}
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
                  <label className={styles.label}>Box</label>
                  <input
                    className={styles.input}
                    value={form.box_number}
                    onChange={(e) => updateField('box_number', e.target.value)}
                  />
                </div>
              )}

              {showPastureField && (
                <div className={styles.field}>
                  <label className={styles.label}>Pasture</label>
                  <input
                    className={styles.input}
                    value={form.pasture_name}
                    onChange={(e) => updateField('pasture_name', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Stable movement</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Left stable at</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.left_stable_at}
                  onChange={(e) => updateField('left_stable_at', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Returned at</label>
                <input
                  className={styles.input}
                  type="datetime-local"
                  value={form.returned_stable_at}
                  onChange={(e) => updateField('returned_stable_at', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Moved to location</label>
                <input
                  className={styles.input}
                  value={form.moved_to_location}
                  onChange={(e) => updateField('moved_to_location', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Moved to detail</label>
                <input
                  className={styles.input}
                  value={form.moved_to_detail}
                  onChange={(e) => updateField('moved_to_detail', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Farrier</h3>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Farrier</label>
                <select
                  className={styles.select}
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
                <label className={styles.label}>Last done</label>
                <input
                  className={styles.input}
                  type="date"
                  value={form.farrier_last_done}
                  onChange={(e) => updateField('farrier_last_done', e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Interval weeks</label>
                <input
                  className={styles.input}
                  type="number"
                  value={form.farrier_interval_weeks}
                  onChange={(e) => updateField('farrier_interval_weeks', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Visibility</h3>

            <div className={styles.toggleGrid}>
              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_rider_planning}
                  onChange={(e) => updateField('show_in_rider_planning', e.target.checked)}
                />
                <div>
                  <span className={styles.toggleTitle}>Rider planning</span>
                  <span className={styles.toggleText}>Show this horse in the rider planner</span>
                </div>
              </label>

              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_mare_cards}
                  onChange={(e) => updateField('show_in_mare_cards', e.target.checked)}
                />
                <div>
                  <span className={styles.toggleTitle}>Mare cards</span>
                  <span className={styles.toggleText}>Show this horse in mare follow-up</span>
                </div>
              </label>

              <label className={styles.toggleCard}>
                <input
                  type="checkbox"
                  checked={form.show_in_tasks}
                  onChange={(e) => updateField('show_in_tasks', e.target.checked)}
                />
                <div>
                  <span className={styles.toggleTitle}>Tasks</span>
                  <span className={styles.toggleText}>Show this horse in task flows</span>
                </div>
              </label>
            </div>
          </div>

          {form.show_in_mare_cards && (
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Mare card</h3>

              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Last in heat</label>
                  <input
                    className={styles.input}
                    type="date"
                    value={form.last_in_heat_date}
                    onChange={(e) => updateField('last_in_heat_date', e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Pregnant</label>
                  <select
                    className={styles.select}
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
                  <label className={styles.label}>Pregnancy notes</label>
                  <textarea
                    className={styles.textarea}
                    value={form.pregnancy_notes}
                    onChange={(e) => updateField('pregnancy_notes', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className={`${styles.card} ${styles.fullWidth}`}>
            <h3 className={styles.cardTitle}>Notes</h3>

            <div className={styles.field}>
              <label className={styles.label}>Notes</label>
              <textarea
                className={styles.textarea}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}