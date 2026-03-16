'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/app/lib/supabaseClient'
import styles from './editHorse.module.css'

type HorseType = 'Sport horse' | 'Young horse' | 'Foal' | 'Mare' | 'Mare with foal'
type StableLocation = '47B' | '47B Big Box' | '50' | 'Oostm' | 'Serre' | 'Vremde'
type VaccinationType = 'flu_tetanus' | 'rhino'

type HorseForm = {
  name: string
  horse_type: '' | HorseType
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

type VaccinationRecord = {
  id: string
  horse_id: string
  vaccine_type: VaccinationType
  administered_on: string
  next_due_on: string | null
  product_name: string | null
  notes: string | null
  created_at: string
}

type PassportStatusRow = {
  horse_id: string
  needs_passport_update: boolean
  passport_updated_at: string | null
  updated_at: string
}

type ProductOption = {
  id: string
  name: string
  category: string | null
}

type BatchStockRow = {
  id: string
  medicine_id: string
  medicine_name: string
  active_substance: string | null
  category: string | null
  form: string | null
  stock_source: 'issuance' | 'begin_stock' | 'correction' | null
  issue_date: string
  expiry_date: string | null
  lot_number: string | null
  issued_by: string | null
  issued_by_other: string | null
  issued_quantity: number
  used_quantity: number
  remaining_quantity: number
  storage_location: string | null
  notes: string | null
  created_at: string
}

type VaccinationEntryForm = {
  date: string
  productName: string
  notes: string
}

const HORSE_TYPES: HorseType[] = [
  'Sport horse',
  'Young horse',
  'Foal',
  'Mare',
  'Mare with foal',
]

const FARRIERS = ['Maarten', 'Kamiel', 'Johan', 'Wim']

const STABLE_LOCATIONS: StableLocation[] = [
  '47B',
  '47B Big Box',
  '50',
  'Oostm',
  'Serre',
  'Vremde',
]

const FLU_INTERVAL_DAYS = 365
const RHINO_INTERVAL_DAYS = 180
const DUE_SOON_DAYS = 30

function locationNeedsBox(location: string) {
  return ['47B', '47B Big Box', '50', 'Serre'].includes(location)
}

function locationUsesMixedSetup(location: string) {
  return location === 'Oostm'
}

function locationUsesPasture(location: string) {
  return location === 'Vremde'
}

function toDateInputValue(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(dateStr: string, days: number) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('nl-BE')
}

function diffInDays(dateStr: string | null) {
  if (!dateStr) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getVaccinationStatus(lastRecord: VaccinationRecord | null) {
  if (!lastRecord || !lastRecord.next_due_on) return 'missing'

  const daysLeft = diffInDays(lastRecord.next_due_on)

  if (daysLeft === null) return 'missing'
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'due-soon'
  return 'ok'
}

function getVaccinationStatusLabel(lastRecord: VaccinationRecord | null) {
  const status = getVaccinationStatus(lastRecord)
  if (status === 'ok') return 'OK'
  if (status === 'overdue') return 'Overdue'
  if (status === 'due-soon') return 'Due soon'
  return 'Missing'
}

function getDueText(dateStr: string | null) {
  const daysLeft = diffInDays(dateStr)
  if (daysLeft === null) return 'No due date'
  if (daysLeft < 0) return `${Math.abs(daysLeft)} d overdue`
  return `${daysLeft} d left`
}

function normalizeMedicine(row: any): ProductOption | null {
  const rawName =
    row.name ??
    row.medicine_name ??
    row.product_name ??
    row.title ??
    row.naam ??
    row.Naam ??
    null

  if (!rawName) return null

  return {
    id: row.id ?? rawName,
    name: String(rawName),
    category: row.category ?? null,
  }
}

function looksLikeVaccine(product: ProductOption) {
  const name = product.name.toLowerCase()
  const category = (product.category || '').toLowerCase()

  return (
    category === 'vaccination' ||
    name.includes('vacc') ||
    name.includes('vaccine') ||
    name.includes('griep') ||
    name.includes('influenza') ||
    name.includes('flu') ||
    name.includes('tetanus') ||
    name.includes('rhino') ||
    name.includes('equilis') ||
    name.includes('proteq') ||
    name.includes('resequin') ||
    name.includes('ehv')
  )
}

function matchesType(product: ProductOption, type: VaccinationType) {
  const name = product.name.toLowerCase()
  const category = (product.category || '').toLowerCase()

  const isVaccinationCategory = category === 'vaccination'
  const isRhinoNamed = name.includes('rhino') || name.includes('ehv')
  const isFluNamed =
    name.includes('flu') ||
    name.includes('influenza') ||
    name.includes('griep') ||
    name.includes('tetanus') ||
    name.includes('equilis') ||
    name.includes('proteq') ||
    name.includes('resequin')

  if (type === 'rhino') {
    return isRhinoNamed || isVaccinationCategory
  }

  return isFluNamed || isVaccinationCategory
}

function batchSortValue(batch: BatchStockRow) {
  if (!batch.expiry_date) return '9999-12-31'
  return batch.expiry_date
}

export default function EditHorsePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingVaccination, setSavingVaccination] = useState<VaccinationType | null>(null)
  const [togglingPassport, setTogglingPassport] = useState(false)
  const [form, setForm] = useState<HorseForm | null>(null)

  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([])
  const [passportStatus, setPassportStatus] = useState<PassportStatusRow | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [batchRows, setBatchRows] = useState<BatchStockRow[]>([])
  const [vremdePastures, setVremdePastures] = useState<string[]>([])

  const [fluForm, setFluForm] = useState<VaccinationEntryForm>({
    date: toDateInputValue(new Date()),
    productName: '',
    notes: '',
  })

  const [rhinoForm, setRhinoForm] = useState<VaccinationEntryForm>({
    date: toDateInputValue(new Date()),
    productName: '',
    notes: '',
  })

  useEffect(() => {
    const loadHorse = async () => {
      setLoading(true)

      const [horseRes, vaccinationRes, passportRes, medicinesRes, batchRes] = await Promise.all([
        supabase
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
          .single(),

        supabase
          .from('vaccination_records')
          .select('*')
          .eq('horse_id', id)
          .order('administered_on', { ascending: false }),

        supabase
          .from('vaccination_passport_status')
          .select('*')
          .eq('horse_id', id)
          .maybeSingle(),

        supabase.from('medicines').select('*'),

        supabase
          .from('medicine_batch_stock_view')
          .select('*')
          .order('medicine_name', { ascending: true })
          .order('expiry_date', { ascending: true }),
      ])

      const horseData = horseRes.data

      if (horseRes.error || !horseData) {
        console.error(horseRes.error)
        setLoading(false)
        return
      }

      const allProducts: ProductOption[] = (medicinesRes.data || [])
        .map((row: any) => normalizeMedicine(row))
        .filter((p): p is ProductOption => Boolean(p))
        .filter((p) => looksLikeVaccine(p))
        .sort((a, b) => a.name.localeCompare(b.name))

      const fluProducts = allProducts.filter((p) => matchesType(p, 'flu_tetanus'))
      const rhinoProducts = allProducts.filter((p) => matchesType(p, 'rhino'))

      const { data: vremdeSite } = await supabase
        .from('sites')
        .select('id')
        .eq('slug', 'vremde')
        .maybeSingle()

      if (vremdeSite?.id) {
        const { data: vremdeUnits } = await supabase
          .from('place_units')
          .select('name, unit_type')
          .eq('site_id', vremdeSite.id)
          .eq('active', true)
          .in('unit_type', ['pasture', 'field', 'paddock'])
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })

        setVremdePastures((vremdeUnits || []).map((u: any) => u.name))
      } else {
        setVremdePastures([])
      }

      setForm({
        name: horseData.name || '',
        horse_type: horseData.horse_type || '',
        left_stable_at: horseData.left_stable_at ? horseData.left_stable_at.slice(0, 16) : '',
        returned_stable_at: horseData.returned_stable_at ? horseData.returned_stable_at.slice(0, 16) : '',
        moved_to_location: horseData.moved_to_location || '',
        moved_to_detail: horseData.moved_to_detail || '',
        farrier_name: horseData.farrier_name || '',
        farrier_last_done: horseData.farrier_last_done || '',
        farrier_interval_weeks: horseData.farrier_interval_weeks
          ? String(horseData.farrier_interval_weeks)
          : '6',
        stable_location: horseData.stable_location || '',
        box_number: horseData.box_number || '',
        pasture_name: horseData.pasture_name || '',
        show_in_rider_planning: horseData.show_in_rider_planning === true,
        show_in_mare_cards: horseData.show_in_mare_cards === true,
        show_in_tasks: horseData.show_in_tasks === true,
        last_in_heat_date: horseData.last_in_heat_date || '',
        pregnant:
          horseData.pregnant === true ? 'yes' : horseData.pregnant === false ? 'no' : 'unknown',
        pregnancy_notes: horseData.pregnancy_notes || '',
        notes: horseData.notes || '',
        active: horseData.active !== false,
      })

      setVaccinationRecords((vaccinationRes.data || []) as VaccinationRecord[])
      setPassportStatus((passportRes.data as PassportStatusRow | null) || null)
      setProducts(allProducts)
      setBatchRows((batchRes.data || []) as BatchStockRow[])

      setFluForm({
        date: toDateInputValue(new Date()),
        productName: fluProducts[0]?.name || '',
        notes: '',
      })

      setRhinoForm({
        date: toDateInputValue(new Date()),
        productName: rhinoProducts[0]?.name || '',
        notes: '',
      })

      setLoading(false)
    }

    void loadHorse()
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

      if (key === 'left_stable_at') {
        const hasLeftDate = Boolean(String(value).trim())

        if (hasLeftDate) {
          next.active = false
          next.returned_stable_at = ''
        }
      }

      if (key === 'returned_stable_at') {
        const hasReturnedDate = Boolean(String(value).trim())

        if (hasReturnedDate) {
          next.active = true
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

  const latestFluRecord = useMemo(() => {
    return vaccinationRecords.find((r) => r.vaccine_type === 'flu_tetanus') || null
  }, [vaccinationRecords])

  const latestRhinoRecord = useMemo(() => {
    return vaccinationRecords.find((r) => r.vaccine_type === 'rhino') || null
  }, [vaccinationRecords])

  const horseHistory = useMemo(() => {
    return [...vaccinationRecords].sort(
      (a, b) => new Date(b.administered_on).getTime() - new Date(a.administered_on).getTime()
    )
  }, [vaccinationRecords])

  const fluProducts = useMemo(() => {
    return products.filter((p) => matchesType(p, 'flu_tetanus'))
  }, [products])

  const rhinoProducts = useMemo(() => {
    return products.filter((p) => matchesType(p, 'rhino'))
  }, [products])

  const isAway = Boolean(form?.left_stable_at) && !Boolean(form?.returned_stable_at)
  const isBackAtStable = Boolean(form?.returned_stable_at)

  async function reloadVaccinationData() {
    const [vaccinationRes, passportRes, batchRes] = await Promise.all([
      supabase
        .from('vaccination_records')
        .select('*')
        .eq('horse_id', id)
        .order('administered_on', { ascending: false }),

      supabase
        .from('vaccination_passport_status')
        .select('*')
        .eq('horse_id', id)
        .maybeSingle(),

      supabase
        .from('medicine_batch_stock_view')
        .select('*')
        .order('medicine_name', { ascending: true })
        .order('expiry_date', { ascending: true }),
    ])

    setVaccinationRecords((vaccinationRes.data || []) as VaccinationRecord[])
    setPassportStatus((passportRes.data as PassportStatusRow | null) || null)
    setBatchRows((batchRes.data || []) as BatchStockRow[])
  }

  async function saveVaccination(type: VaccinationType) {
    if (!form) return

    const entry = type === 'flu_tetanus' ? fluForm : rhinoForm

    if (!entry.date) {
      alert('Kies eerst een datum')
      return
    }

    setSavingVaccination(type)

    const nextDue =
      type === 'flu_tetanus'
        ? addDays(entry.date, FLU_INTERVAL_DAYS)
        : addDays(entry.date, RHINO_INTERVAL_DAYS)

    const product = products.find((p) => p.name === entry.productName) || null

    let chosenBatch: BatchStockRow | null = null

    if (product) {
      const possibleBatches = batchRows
        .filter((b) => b.medicine_id === product.id && Number(b.remaining_quantity) > 0)
        .sort((a, b) => batchSortValue(a).localeCompare(batchSortValue(b)))

      chosenBatch = possibleBatches[0] || null
    }

    const { data: createdVaccination, error: vaccinationError } = await supabase
      .from('vaccination_records')
      .insert({
        horse_id: id,
        vaccine_type: type,
        administered_on: entry.date,
        next_due_on: nextDue,
        product_name: entry.productName || null,
        notes: entry.notes || null,
      })
      .select()
      .single()

    if (vaccinationError || !createdVaccination) {
      alert(vaccinationError?.message || 'Could not save vaccination.')
      setSavingVaccination(null)
      return
    }

    if (product && chosenBatch) {
      const horseName = form.name || 'Unnamed horse'
      const usageNotes = entry.notes?.trim()
        ? `Vaccination | ${entry.notes.trim()}`
        : 'Vaccination'

      const { error: usageError } = await supabase.from('medicine_usage').insert({
        medicine_id: product.id,
        issuance_id: chosenBatch.id,
        vaccination_record_id: createdVaccination.id,
        usage_date: entry.date,
        quantity: 1,
        horse_scope: 'selected',
        horse_ids: [id],
        horse_names: [horseName],
        notes: usageNotes,
      })

      if (usageError) {
        alert(usageError.message || 'Vaccination saved, but stock/register was not updated.')
      }
    } else if (product && !chosenBatch) {
      alert('Vaccination saved, but no stock batch with remaining quantity was found for this product.')
    }

    await supabase
      .from('vaccination_passport_status')
      .upsert(
        {
          horse_id: id,
          needs_passport_update: true,
          passport_updated_at: null,
        },
        { onConflict: 'horse_id' }
      )

    await reloadVaccinationData()

    if (type === 'flu_tetanus') {
      setFluForm((prev) => ({ ...prev, notes: '' }))
    } else {
      setRhinoForm((prev) => ({ ...prev, notes: '' }))
    }

    setSavingVaccination(null)
  }

  async function deleteVaccinationRecord(recordId: string) {
    const confirmed = window.confirm('Delete this vaccination record?')
    if (!confirmed) return

    const recordToDelete = vaccinationRecords.find((r) => r.id === recordId)
    if (!recordToDelete) return

    const { error: usageDeleteError } = await supabase
      .from('medicine_usage')
      .delete()
      .eq('vaccination_record_id', recordId)

    if (usageDeleteError) {
      alert(usageDeleteError.message || 'Could not delete linked stock/register line.')
      return
    }

    const { error: deleteError } = await supabase
      .from('vaccination_records')
      .delete()
      .eq('id', recordId)

    if (deleteError) {
      alert(deleteError.message || 'Could not delete vaccination.')
      return
    }

    await supabase
      .from('vaccination_passport_status')
      .upsert(
        {
          horse_id: id,
          needs_passport_update: false,
          passport_updated_at: null,
        },
        { onConflict: 'horse_id' }
      )

    await reloadVaccinationData()
  }

  async function togglePassportDone(checked: boolean) {
    setTogglingPassport(true)

    await supabase
      .from('vaccination_passport_status')
      .upsert(
        {
          horse_id: id,
          needs_passport_update: !checked,
          passport_updated_at: checked ? new Date().toISOString() : null,
        },
        { onConflict: 'horse_id' }
      )

    await reloadVaccinationData()
    setTogglingPassport(false)
  }

  async function syncHorsePlaceAfterSave(nextForm: HorseForm, horseId: string) {
    const isAwayNow = Boolean(nextForm.left_stable_at) && !Boolean(nextForm.returned_stable_at)

    if (isAwayNow) return
    if (!nextForm.active) return

    if (nextForm.stable_location === 'Vremde' && nextForm.pasture_name) {
      const { data: siteRow, error: siteError } = await supabase
        .from('sites')
        .select('id')
        .eq('slug', 'vremde')
        .single()

      if (siteError || !siteRow) {
        throw new Error('Vremde site not found.')
      }

      const { data: unitRow, error: unitError } = await supabase
        .from('place_units')
        .select('id, area_id, name')
        .eq('site_id', siteRow.id)
        .eq('name', nextForm.pasture_name)
        .eq('active', true)
        .single()

      if (unitError || !unitRow) {
        throw new Error(`Pasture "${nextForm.pasture_name}" not found in place_units.`)
      }

      const { error: moveError } = await supabase.rpc('move_horse_v2', {
        p_horse_id: horseId,
        p_site_id: siteRow.id,
        p_area_id: unitRow.area_id,
        p_unit_id: unitRow.id,
        p_moved_by: 'Martin',
        p_move_note: `Set from horse editor to ${unitRow.name}`,
        p_assigned_at: new Date().toISOString(),
      })

      if (moveError) {
        throw new Error(moveError.message)
      }
    }
  }

  const saveHorse = async () => {
    if (!form) return

    if (form.left_stable_at && !form.moved_to_location.trim()) {
      alert('Vul in naar welke klant of locatie het paard is vertrokken.')
      return
    }

    if (form.returned_stable_at && !form.stable_location) {
      alert('Kies opnieuw een locatie binnen het bedrijf.')
      return
    }

    setSaving(true)

    const isAwayNow = Boolean(form.left_stable_at) && !Boolean(form.returned_stable_at)
    const isBackNow = Boolean(form.returned_stable_at)

    const payload = {
      name: form.name || null,
      horse_type: form.horse_type || null,
      stable_status: isAwayNow ? 'away' : form.active ? 'active' : 'inactive',
      left_stable_at: form.left_stable_at || null,
      returned_stable_at: form.returned_stable_at || null,
      moved_to_location: form.moved_to_location || null,
      moved_to_detail: form.moved_to_detail || null,
      farrier_name: form.farrier_name || null,
      farrier_last_done: form.farrier_last_done || null,
      farrier_interval_weeks: form.farrier_interval_weeks
        ? Number(form.farrier_interval_weeks)
        : 6,
      stable_location: isBackNow || !isAwayNow ? form.stable_location || null : null,
      box_number: isBackNow || !isAwayNow ? form.box_number || null : null,
      pasture_name: isBackNow || !isAwayNow ? form.pasture_name || null : null,
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
      active: isAwayNow ? false : form.active,
    }

    const { error } = await supabase.from('horses').update(payload).eq('id', id)

    if (error) {
      console.error(error)
      alert('Opslaan mislukt')
      setSaving(false)
      return
    }

    try {
      await syncHorsePlaceAfterSave(form, id)
    } catch (placeError) {
      console.error(placeError)
      alert(
        placeError instanceof Error
          ? `Paard is opgeslagen, maar plaats kon niet gesynchroniseerd worden: ${placeError.message}`
          : 'Paard is opgeslagen, maar plaats kon niet gesynchroniseerd worden.'
      )
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

  const fluStatus = getVaccinationStatus(latestFluRecord)
  const rhinoStatus = getVaccinationStatus(latestRhinoRecord)

  return (
    <section className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.detailTopBar}>
          <div className={styles.detailActions}>
            <button className={styles.backButton} onClick={() => router.back()}>
              Back
            </button>
          </div>

          <div className={styles.detailActions}>
            <button className={styles.primaryButton} onClick={saveHorse} disabled={saving}>
              {saving ? 'Saving...' : 'Save horse'}
            </button>
          </div>
        </div>

        <div className={styles.detailGrid}>
          <div className={`${styles.detailCard} ${styles.heroCard}`}>
            <span className={styles.kicker}>Horse profile</span>

            <div className={styles.heroTop}>
              <div>
                <h1 className={styles.heroName}>{form.name || 'Unnamed horse'}</h1>
                <p className={styles.heroSubline}>
                  Pas hier snel naam, plaats, smid en vaccinaties aan.
                </p>

                <div className={styles.heroFlags}>
                  <span className={`${styles.miniFlag} ${form.active ? styles.flagOn : styles.flagOff}`}>
                    {form.active ? 'Active' : 'Inactive'}
                  </span>

                  <span className={`${styles.miniFlag} ${isAway ? styles.awayFlag : styles.flagOff}`}>
                    {isAway ? 'Away from stable' : 'At stable'}
                  </span>

                  <span className={`${styles.miniFlag} ${form.show_in_tasks ? styles.flagOn : styles.flagOff}`}>
                    Tasks
                  </span>

                  <span className={`${styles.miniFlag} ${form.show_in_rider_planning ? styles.flagOn : styles.flagOff}`}>
                    Rider planning
                  </span>

                  <span className={`${styles.miniFlag} ${form.show_in_mare_cards ? styles.flagOn : styles.flagOff}`}>
                    Mare cards
                  </span>
                </div>
              </div>

              <div className={styles.countBox}>
                <span>Vaccines saved</span>
                <strong>{horseHistory.length}</strong>
              </div>
            </div>
          </div>

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
                <label>Active</label>
                <select
                  className={styles.input}
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => updateField('active', e.target.value === 'true')}
                  disabled={isAway}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
                {isAway && (
                  <div className={styles.inlineNote}>
                    Dit staat automatisch op inactive omdat het paard uit de stal is.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Place</h3>

            <div className={styles.sectionBlock}>
              <div className={styles.blockTitle}>Inside the company</div>

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
                    />
                  </div>
                )}

                {showPastureField && (
                  <div className={styles.field}>
                    <label>Pasture</label>
                    <select
                      className={styles.input}
                      value={form.pasture_name}
                      onChange={(e) => updateField('pasture_name', e.target.value)}
                    >
                      <option value="">Select pasture</option>
                      {vremdePastures.map((pasture) => (
                        <option key={pasture} value={pasture}>
                          {pasture}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <div className={styles.blockTitle}>Temporary away</div>

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
                  <label>To client / location</label>
                  <input
                    className={styles.input}
                    value={form.moved_to_location}
                    onChange={(e) => updateField('moved_to_location', e.target.value)}
                    placeholder="Bijv. klantnaam, concours, kliniek..."
                  />
                </div>

                <div className={`${styles.field} ${styles.fullField}`}>
                  <label>Extra detail</label>
                  <input
                    className={styles.input}
                    value={form.moved_to_detail}
                    onChange={(e) => updateField('moved_to_detail', e.target.value)}
                    placeholder="Bijv. stallingsdetail, contactpersoon, opmerkingen..."
                  />
                </div>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <div className={styles.blockTitle}>Returned</div>

              <div className={styles.formGrid}>
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
                  <label>Status after return</label>
                  <div className={styles.readonlyBox}>
                    {isBackAtStable ? 'Active again' : isAway ? 'Away from stable' : 'At stable'}
                  </div>
                </div>
              </div>

              {form.returned_stable_at && (
                <div className={styles.inlineNote}>
                  Na terugkomst moet je opnieuw een interne locatie hierboven kiezen.
                </div>
              )}
            </div>
          </div>

          <div className={styles.detailCard}>
            <h3 className={styles.cardTitle}>Farrier</h3>

            <div className={styles.infoGrid}>
              <div className={styles.infoItem}>
                <span>Current farrier</span>
                <strong>{form.farrier_name || '—'}</strong>
              </div>
              <div className={styles.infoItem}>
                <span>Last done</span>
                <strong>{form.farrier_last_done ? formatDate(form.farrier_last_done) : '—'}</strong>
              </div>
            </div>

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
            </div>
          </div>

          <div className={`${styles.detailCard} ${styles.fullWidth}`}>
            <h3 className={styles.cardTitle}>Vaccinations</h3>

            <div className={styles.vaccHeaderRow}>
              <div className={styles.passportBox}>
                <span className={styles.passportLabel}>Passport</span>
                <label className={styles.passportToggle}>
                  <input
                    type="checkbox"
                    checked={!passportStatus?.needs_passport_update}
                    onChange={(e) => togglePassportDone(e.target.checked)}
                    disabled={togglingPassport}
                  />
                  <span>
                    {!passportStatus?.needs_passport_update ? 'Updated' : 'Needs update'}
                  </span>
                </label>
                <div className={styles.passportDate}>
                  Last passport update: {formatDate(passportStatus?.passport_updated_at || null)}
                </div>
              </div>
            </div>

            <div className={styles.vaccGrid}>
              <div className={styles.vaccCard}>
                <div className={styles.vaccTop}>
                  <div>
                    <div className={styles.vaccTitle}>Flu + Tetanus</div>
                    <div className={styles.vaccMetaLine}>
                      {getDueText(latestFluRecord?.next_due_on || null)}
                    </div>
                  </div>

                  <span
                    className={`${styles.statusPill} ${
                      fluStatus === 'ok'
                        ? styles.okTag
                        : fluStatus === 'due-soon'
                          ? styles.warningTag
                          : fluStatus === 'overdue'
                            ? styles.dangerTag
                            : styles.neutralTag
                    }`}
                  >
                    {getVaccinationStatusLabel(latestFluRecord)}
                  </span>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span>Last</span>
                    <strong>{formatDate(latestFluRecord?.administered_on || null)}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <span>Due</span>
                    <strong>{formatDate(latestFluRecord?.next_due_on || null)}</strong>
                  </div>
                  <div className={`${styles.infoItem} ${styles.fullSpan}`}>
                    <span>Product</span>
                    <strong>{latestFluRecord?.product_name || '—'}</strong>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label>Vaccinated on</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={fluForm.date}
                      onChange={(e) =>
                        setFluForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label>Product</label>
                    <select
                      className={styles.input}
                      value={fluForm.productName}
                      onChange={(e) =>
                        setFluForm((prev) => ({ ...prev, productName: e.target.value }))
                      }
                    >
                      <option value="">Select product</option>
                      {fluProducts.map((product) => (
                        <option key={product.id} value={product.name}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`${styles.field} ${styles.fullField}`}>
                    <label>Notes</label>
                    <textarea
                      className={styles.textarea}
                      value={fluForm.notes}
                      onChange={(e) =>
                        setFluForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                    />
                  </div>

                  <div className={`${styles.field} ${styles.fullField}`}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => saveVaccination('flu_tetanus')}
                      disabled={savingVaccination === 'flu_tetanus'}
                    >
                      {savingVaccination === 'flu_tetanus'
                        ? 'Saving...'
                        : 'Save Flu + Tetanus'}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.vaccCard}>
                <div className={styles.vaccTop}>
                  <div>
                    <div className={styles.vaccTitle}>Rhino</div>
                    <div className={styles.vaccMetaLine}>
                      {getDueText(latestRhinoRecord?.next_due_on || null)}
                    </div>
                  </div>

                  <span
                    className={`${styles.statusPill} ${
                      rhinoStatus === 'ok'
                        ? styles.okTag
                        : rhinoStatus === 'due-soon'
                          ? styles.warningTag
                          : rhinoStatus === 'overdue'
                            ? styles.dangerTag
                            : styles.neutralTag
                    }`}
                  >
                    {getVaccinationStatusLabel(latestRhinoRecord)}
                  </span>
                </div>

                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <span>Last</span>
                    <strong>{formatDate(latestRhinoRecord?.administered_on || null)}</strong>
                  </div>
                  <div className={styles.infoItem}>
                    <span>Due</span>
                    <strong>{formatDate(latestRhinoRecord?.next_due_on || null)}</strong>
                  </div>
                  <div className={`${styles.infoItem} ${styles.fullSpan}`}>
                    <span>Product</span>
                    <strong>{latestRhinoRecord?.product_name || '—'}</strong>
                  </div>
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label>Vaccinated on</label>
                    <input
                      className={styles.input}
                      type="date"
                      value={rhinoForm.date}
                      onChange={(e) =>
                        setRhinoForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                    />
                  </div>

                  <div className={styles.field}>
                    <label>Product</label>
                    <select
                      className={styles.input}
                      value={rhinoForm.productName}
                      onChange={(e) =>
                        setRhinoForm((prev) => ({ ...prev, productName: e.target.value }))
                      }
                    >
                      <option value="">Select product</option>
                      {rhinoProducts.map((product) => (
                        <option key={product.id} value={product.name}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={`${styles.field} ${styles.fullField}`}>
                    <label>Notes</label>
                    <textarea
                      className={styles.textarea}
                      value={rhinoForm.notes}
                      onChange={(e) =>
                        setRhinoForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                    />
                  </div>

                  <div className={`${styles.field} ${styles.fullField}`}>
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={() => saveVaccination('rhino')}
                      disabled={savingVaccination === 'rhino'}
                    >
                      {savingVaccination === 'rhino' ? 'Saving...' : 'Save Rhino'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.historyBlock}>
              <div className={styles.historyHead}>
                <h4 className={styles.historyTitle}>Vaccination history</h4>
              </div>

              {horseHistory.length === 0 ? (
                <div className={styles.emptyState}>No vaccination history yet.</div>
              ) : (
                <div className={styles.historyList}>
                  <div className={styles.historyRowHead}>
                    <div>Type</div>
                    <div>Date</div>
                    <div>Due</div>
                    <div>Product</div>
                    <div></div>
                  </div>

                  {horseHistory.map((record) => (
                    <div key={record.id} className={styles.historyRow}>
                      <div className={styles.historyType}>
                        {record.vaccine_type === 'flu_tetanus' ? 'Flu + Tetanus' : 'Rhino'}
                      </div>
                      <div>{formatDate(record.administered_on)}</div>
                      <div>{formatDate(record.next_due_on)}</div>
                      <div>{record.product_name || '—'}</div>
                      <div className={styles.historyActions}>
                        <button
                          className={styles.secondaryButton}
                          type="button"
                          onClick={() => deleteVaccinationRecord(record.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    value={form.pregnancy_notes}
                    onChange={(e) => updateField('pregnancy_notes', e.target.value)}
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