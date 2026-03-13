'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './VaccinationsTab.css'

type Horse = {
  id: string
  name: string | null
  stable_name: string | null
  active: boolean | null
}

type VaccinationRecord = {
  id: string
  horse_id: string
  vaccine_type: 'flu_tetanus' | 'rhino'
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

type SummaryRow = {
  horse: Horse
  fluLast: VaccinationRecord | null
  rhinoLast: VaccinationRecord | null
  needsPassportUpdate: boolean
  passportUpdatedAt: string | null
}

type FilterType = 'all' | 'urgent' | 'passport' | 'flu' | 'rhino'

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

type FormState = {
  horseId: string
  type: 'flu_tetanus' | 'rhino'
  date: string
  productName: string
  notes: string
}

type Props = {
  onBack?: () => void
}

const FLU_INTERVAL_DAYS = 365
const RHINO_INTERVAL_DAYS = 180
const DUE_SOON_DAYS = 30

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('nl-BE')
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

function diffInDays(dateStr: string | null) {
  if (!dateStr) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)

  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getStatus(lastRecord: VaccinationRecord | null) {
  if (!lastRecord || !lastRecord.next_due_on) return 'missing'

  const daysLeft = diffInDays(lastRecord.next_due_on)

  if (daysLeft === null) return 'missing'
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'due-soon'
  return 'ok'
}

function getStatusLabel(lastRecord: VaccinationRecord | null) {
  const status = getStatus(lastRecord)
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

function sortWeight(status: string) {
  if (status === 'overdue') return 0
  if (status === 'due-soon') return 1
  if (status === 'missing') return 2
  return 3
}

function normalizeHorse(row: any): Horse | null {
  if (!row?.id) return null

  const resolvedName =
    row.name ??
    row.Naam ??
    row.naam ??
    row.horse_name ??
    row.horse ??
    row.paard ??
    row['Naam+Naam'] ??
    row.stable_name ??
    null

  const resolvedStableName =
    row.stable_name ??
    row.stable ??
    row.barn_name ??
    null

  const resolvedActive =
    typeof row.active === 'boolean'
      ? row.active
      : typeof row.is_active === 'boolean'
        ? row.is_active
        : typeof row.Active === 'boolean'
          ? row.Active
          : true

  return {
    id: row.id,
    name: resolvedName,
    stable_name: resolvedStableName,
    active: resolvedActive,
  }
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

function matchesType(product: ProductOption, type: 'flu_tetanus' | 'rhino') {
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

  if (type === 'flu_tetanus') {
    return isFluNamed || isVaccinationCategory
  }

  return false
}

function batchSortValue(batch: BatchStockRow) {
  if (!batch.expiry_date) return '9999-12-31'
  return batch.expiry_date
}

export default function VaccinationsTab({ onBack }: Props) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [records, setRecords] = useState<VaccinationRecord[]>([])
  const [passportStatuses, setPassportStatuses] = useState<Record<string, PassportStatusRow>>({})
  const [products, setProducts] = useState<ProductOption[]>([])
  const [batchRows, setBatchRows] = useState<BatchStockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingHorseId, setSavingHorseId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')
  const [openHistoryHorseId, setOpenHistoryHorseId] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [openForm, setOpenForm] = useState<FormState | null>(null)

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [horsesRes, recordsRes, passportRes, medicinesRes, batchRes] = await Promise.all([
      supabase.from('horses').select('*'),
      supabase.from('vaccination_records').select('*').order('administered_on', { ascending: false }),
      supabase.from('vaccination_passport_status').select('*'),
      supabase.from('medicines').select('*'),
      supabase
        .from('medicine_batch_stock_view')
        .select('*')
        .order('medicine_name', { ascending: true })
        .order('expiry_date', { ascending: true }),
    ])

    const passportMap: Record<string, PassportStatusRow> = {}
    ;(passportRes.data || []).forEach((row: any) => {
      passportMap[row.horse_id] = row
    })

    const normalizedHorses: Horse[] = (horsesRes.data || [])
      .map((horse: any) => normalizeHorse(horse))
      .filter((horse): horse is Horse => Boolean(horse))
      .filter((horse) => horse.active !== false)
      .sort((a, b) => (a.name || a.stable_name || '').localeCompare(b.name || b.stable_name || ''))

    const normalizedProducts: ProductOption[] = (medicinesRes.data || [])
      .map((row: any) => normalizeMedicine(row))
      .filter((p): p is ProductOption => Boolean(p))
      .filter((p) => looksLikeVaccine(p))
      .sort((a, b) => a.name.localeCompare(b.name))

    setHorses(normalizedHorses)
    setRecords((recordsRes.data || []) as VaccinationRecord[])
    setPassportStatuses(passportMap)
    setProducts(normalizedProducts)
    setBatchRows((batchRes.data || []) as BatchStockRow[])
    setLoading(false)
  }

  function openVaccinationForm(horseId: string, type: 'flu_tetanus' | 'rhino') {
    const typeProducts = products.filter((p) => matchesType(p, type))

    setOpenForm({
      horseId,
      type,
      date: toDateInputValue(new Date()),
      productName: typeProducts[0]?.name || '',
      notes: '',
    })
  }

  function closeVaccinationForm() {
    setOpenForm(null)
  }

  async function saveVaccinationForm() {
    if (!openForm) return

    const horse = horses.find((h) => h.id === openForm.horseId)
    const horseName = horse?.name || horse?.stable_name || 'Unnamed horse'

    setSavingHorseId(openForm.horseId)

    const nextDue =
      openForm.type === 'flu_tetanus'
        ? addDays(openForm.date, FLU_INTERVAL_DAYS)
        : addDays(openForm.date, RHINO_INTERVAL_DAYS)

    const product = products.find((p) => p.name === openForm.productName) || null

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
        horse_id: openForm.horseId,
        vaccine_type: openForm.type,
        administered_on: openForm.date,
        next_due_on: nextDue,
        product_name: openForm.productName || null,
        notes: openForm.notes || null,
      })
      .select()
      .single()

    if (vaccinationError || !createdVaccination) {
      alert(vaccinationError?.message || 'Could not save vaccination.')
      setSavingHorseId(null)
      return
    }

    if (product && chosenBatch) {
      const usageNotes = openForm.notes?.trim()
        ? `Vaccination | ${openForm.notes.trim()}`
        : 'Vaccination'

      const { error: usageError } = await supabase
        .from('medicine_usage')
        .insert({
          medicine_id: product.id,
          issuance_id: chosenBatch.id,
          vaccination_record_id: createdVaccination.id,
          usage_date: openForm.date,
          quantity: 1,
          horse_scope: 'selected',
          horse_ids: [openForm.horseId],
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
          horse_id: openForm.horseId,
          needs_passport_update: true,
          passport_updated_at: null,
        },
        { onConflict: 'horse_id' }
      )

    await loadData()
    setSavingHorseId(null)
    setOpenForm(null)
  }

  async function togglePassportDone(horseId: string, checked: boolean) {
    setSavingHorseId(horseId)

    await supabase
      .from('vaccination_passport_status')
      .upsert(
        {
          horse_id: horseId,
          needs_passport_update: !checked,
          passport_updated_at: checked ? new Date().toISOString() : null,
        },
        { onConflict: 'horse_id' }
      )

    await loadData()
    setSavingHorseId(null)
  }

  async function deleteVaccinationRecord(recordId: string) {
    const confirmed = window.confirm('Delete this vaccination record?')
    if (!confirmed) return

    const recordToDelete = records.find((r) => r.id === recordId)
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
          horse_id: recordToDelete.horse_id,
          needs_passport_update: false,
          passport_updated_at: null,
        },
        { onConflict: 'horse_id' }
      )

    await loadData()
  }

  function toggleHorseHistory(horseId: string) {
    setOpenHistoryHorseId((current) => (current === horseId ? null : horseId))
  }

  const horseNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    horses.forEach((horse) => {
      map[horse.id] = horse.name || horse.stable_name || 'Unnamed horse'
    })
    return map
  }, [horses])

  const summaries = useMemo<SummaryRow[]>(() => {
    return horses.map((horse) => {
      const horseRecords = records.filter((r) => r.horse_id === horse.id)
      const fluLast = horseRecords.find((r) => r.vaccine_type === 'flu_tetanus') || null
      const rhinoLast = horseRecords.find((r) => r.vaccine_type === 'rhino') || null
      const passport = passportStatuses[horse.id]

      return {
        horse,
        fluLast,
        rhinoLast,
        needsPassportUpdate: passport?.needs_passport_update ?? false,
        passportUpdatedAt: passport?.passport_updated_at ?? null,
      }
    })
  }, [horses, records, passportStatuses])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = summaries.filter((row) => {
      const horseName = (row.horse.name || row.horse.stable_name || '').toLowerCase()

      if (q && !horseName.includes(q)) return false

      const fluStatus = getStatus(row.fluLast)
      const rhinoStatus = getStatus(row.rhinoLast)

      if (filter === 'urgent') {
        return (
          fluStatus === 'overdue' ||
          fluStatus === 'due-soon' ||
          rhinoStatus === 'overdue' ||
          rhinoStatus === 'due-soon'
        )
      }

      if (filter === 'passport') {
        return row.needsPassportUpdate
      }

      return true
    })

    result.sort((a, b) => {
      const aStatus =
        filter === 'rhino'
          ? sortWeight(getStatus(a.rhinoLast))
          : filter === 'flu'
            ? sortWeight(getStatus(a.fluLast))
            : Math.min(sortWeight(getStatus(a.fluLast)), sortWeight(getStatus(a.rhinoLast)))

      const bStatus =
        filter === 'rhino'
          ? sortWeight(getStatus(b.rhinoLast))
          : filter === 'flu'
            ? sortWeight(getStatus(b.fluLast))
            : Math.min(sortWeight(getStatus(b.fluLast)), sortWeight(getStatus(b.rhinoLast)))

      if (aStatus !== bStatus) return aStatus - bStatus

      const aName = a.horse.name || a.horse.stable_name || ''
      const bName = b.horse.name || b.horse.stable_name || ''
      return aName.localeCompare(bName)
    })

    return result
  }, [summaries, search, filter])

  const stats = useMemo(() => {
    let overdue = 0
    let dueSoon = 0
    let passportUpdatesNeeded = 0

    summaries.forEach((row) => {
      const fluStatus = getStatus(row.fluLast)
      const rhinoStatus = getStatus(row.rhinoLast)

      if (fluStatus === 'overdue' || rhinoStatus === 'overdue') overdue += 1
      else if (fluStatus === 'due-soon' || rhinoStatus === 'due-soon') dueSoon += 1

      if (row.needsPassportUpdate) passportUpdatesNeeded += 1
    })

    return {
      total: summaries.length,
      overdue,
      dueSoon,
      passportUpdatesNeeded,
    }
  }, [summaries])

  const allHistoryRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.administered_on).getTime() - new Date(a.administered_on).getTime()
    )
  }, [records])

  function renderHistoryList(historyRecords: VaccinationRecord[], showHorseName: boolean) {
    if (historyRecords.length === 0) {
      return <div className="vacc-empty small">No vaccination history yet.</div>
    }

    return (
      <div className="vacc-history-list">
        <div className="vacc-history-head">
          <div>{showHorseName ? 'Horse' : 'Type'}</div>
          <div>Date</div>
          <div>Due</div>
          <div>Product</div>
          <div>Notes</div>
          <div></div>
        </div>

        {historyRecords.map((record) => (
          <div key={record.id} className="vacc-history-item compact">
            <div className="vacc-history-col vacc-history-type">
              {showHorseName ? (
                <div>
                  <div className="vacc-history-horse-name-table">
                    {horseNameMap[record.horse_id] || 'Unnamed horse'}
                  </div>
                  <div className="vacc-history-subtype">
                    {record.vaccine_type === 'flu_tetanus' ? 'Flu + Tetanus' : 'Rhino'}
                  </div>
                </div>
              ) : (
                <div className="vacc-history-subtype strong">
                  {record.vaccine_type === 'flu_tetanus' ? 'Flu + Tetanus' : 'Rhino'}
                </div>
              )}
            </div>

            <div className="vacc-history-col">{formatDate(record.administered_on)}</div>
            <div className="vacc-history-col">{formatDate(record.next_due_on)}</div>
            <div className="vacc-history-col vacc-history-product">{record.product_name || '—'}</div>
            <div className="vacc-history-col vacc-history-notes">{record.notes || '—'}</div>

            <div className="vacc-history-actions">
              <button
                className="vacc-delete-icon-btn"
                type="button"
                onClick={() => deleteVaccinationRecord(record.id)}
                title="Delete vaccination"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="vacc-page">
      <div className="vacc-topbar">
        <div>
          <span className="vacc-kicker">Health Management</span>
          <h2 className="vacc-title">Vaccinations</h2>
          <p className="vacc-subtitle">
            Overzicht van tetanus + griep, rhino en paspoortopvolging.
          </p>
        </div>

        <div className="vacc-topbar-actions">
          <button
            className="vacc-back-btn"
            type="button"
            onClick={() => setShowAllHistory((prev) => !prev)}
          >
            {showAllHistory ? 'Hide all history' : 'Show all history'}
          </button>

          {onBack && (
            <button className="vacc-back-btn" type="button" onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
      </div>

      <div className="vacc-stats">
        <div className="vacc-stat-card">
          <span className="vacc-stat-label">Active horses</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="vacc-stat-card urgent">
          <span className="vacc-stat-label">Overdue</span>
          <strong>{stats.overdue}</strong>
        </div>

        <div className="vacc-stat-card warning">
          <span className="vacc-stat-label">Due soon</span>
          <strong>{stats.dueSoon}</strong>
        </div>

        <div className="vacc-stat-card neutral">
          <span className="vacc-stat-label">Passport updates needed</span>
          <strong>{stats.passportUpdatesNeeded}</strong>
        </div>
      </div>

      <div className="vacc-toolbar">
        <div className="vacc-filters">
          <button className={`vacc-filter-btn ${filter === 'all' ? 'active' : ''}`} type="button" onClick={() => setFilter('all')}>
            All
          </button>
          <button className={`vacc-filter-btn ${filter === 'urgent' ? 'active' : ''}`} type="button" onClick={() => setFilter('urgent')}>
            Urgent
          </button>
          <button className={`vacc-filter-btn ${filter === 'passport' ? 'active' : ''}`} type="button" onClick={() => setFilter('passport')}>
            Passport
          </button>
          <button className={`vacc-filter-btn ${filter === 'flu' ? 'active' : ''}`} type="button" onClick={() => setFilter('flu')}>
            Flu + Tetanus
          </button>
          <button className={`vacc-filter-btn ${filter === 'rhino' ? 'active' : ''}`} type="button" onClick={() => setFilter('rhino')}>
            Rhino
          </button>
        </div>

        <input
          className="vacc-search"
          type="text"
          placeholder="Search horse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showAllHistory && (
        <div className="vacc-history-panel">
          <div className="vacc-history-top">
            <div>
              <span className="vacc-history-kicker">All vaccination history</span>
              <h3 className="vacc-history-title">All horses</h3>
            </div>

            <button
              className="vacc-close-history"
              type="button"
              onClick={() => setShowAllHistory(false)}
            >
              Close
            </button>
          </div>

          {renderHistoryList(allHistoryRecords, true)}
        </div>
      )}

      <div className="vacc-table-wrap">
        <div className="vacc-table vacc-list">
          <div className="vacc-row vacc-head vacc-list-head">
            <div>Horse</div>
            <div>Flu + Tetanus</div>
            <div>Rhino</div>
            <div>Passport</div>
          </div>

          {loading ? (
            <div className="vacc-empty">Loading...</div>
          ) : filteredRows.length === 0 ? (
            <div className="vacc-empty">No active horses found.</div>
          ) : (
            filteredRows.map((row) => {
              const horseName = row.horse.name || row.horse.stable_name || 'Unnamed horse'
              const fluStatus = getStatus(row.fluLast)
              const rhinoStatus = getStatus(row.rhinoLast)
              const isSaving = savingHorseId === row.horse.id

              const horseHistory = allHistoryRecords.filter((r) => r.horse_id === row.horse.id)
              const isHistoryOpen = openHistoryHorseId === row.horse.id

              const fluProducts = products.filter((p) => matchesType(p, 'flu_tetanus'))
              const rhinoProducts = products.filter((p) => matchesType(p, 'rhino'))

              const isOpenFluForm =
                openForm?.horseId === row.horse.id && openForm?.type === 'flu_tetanus'

              const isOpenRhinoForm =
                openForm?.horseId === row.horse.id && openForm?.type === 'rhino'

              return (
                <Fragment key={row.horse.id}>
                  <div className="vacc-row vacc-list-row">
                    <div className="vacc-horse-col">
                      <div className="vacc-horse-main compact">
                        <span className="vacc-horse-name">{horseName}</span>
                        <button
                          className="vacc-history-link"
                          type="button"
                          onClick={() => toggleHorseHistory(row.horse.id)}
                        >
                          {isHistoryOpen ? 'Hide history' : 'View history'}
                        </button>
                      </div>
                    </div>

                    <div className="vacc-cell-block compact">
                      <div className="vacc-cell-top compact">
                        <span className={`vacc-badge ${fluStatus}`}>
                          {getStatusLabel(row.fluLast)}
                        </span>

                        <button
                          className="vacc-action-btn"
                          type="button"
                          onClick={() => openVaccinationForm(row.horse.id, 'flu_tetanus')}
                          disabled={isSaving}
                          title="Vaccination toevoegen"
                        >
                          +
                        </button>
                      </div>

                      <div className="vacc-meta compact">
                        <span><strong>Last:</strong> {formatDate(row.fluLast?.administered_on || null)}</span>
                        <span><strong>Due:</strong> {formatDate(row.fluLast?.next_due_on || null)}</span>
                        <span>{getDueText(row.fluLast?.next_due_on || null)}</span>
                      </div>

                      {isOpenFluForm && openForm && (
                        <div className="vacc-entry-form">
                          <div className="vacc-entry-grid">
                            <div className="vacc-entry-field">
                              <label>Date</label>
                              <input
                                type="date"
                                value={openForm.date}
                                onChange={(e) =>
                                  setOpenForm((prev) =>
                                    prev ? { ...prev, date: e.target.value } : prev
                                  )
                                }
                              />
                            </div>

                            <div className="vacc-entry-field">
                              <label>Product</label>
                              <select
                                value={openForm.productName}
                                onChange={(e) =>
                                  setOpenForm((prev) =>
                                    prev ? { ...prev, productName: e.target.value } : prev
                                  )
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
                          </div>

                          <div className="vacc-entry-field">
                            <label>Notes</label>
                            <textarea
                              rows={3}
                              value={openForm.notes}
                              onChange={(e) =>
                                setOpenForm((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : prev
                                )
                              }
                            />
                          </div>

                          <div className="vacc-entry-actions">
                            <button
                              className="vacc-secondary-btn"
                              type="button"
                              onClick={closeVaccinationForm}
                            >
                              Cancel
                            </button>
                            <button
                              className="vacc-save-btn"
                              type="button"
                              onClick={saveVaccinationForm}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="vacc-cell-block compact">
                      <div className="vacc-cell-top compact">
                        <span className={`vacc-badge ${rhinoStatus}`}>
                          {getStatusLabel(row.rhinoLast)}
                        </span>

                        <button
                          className="vacc-action-btn"
                          type="button"
                          onClick={() => openVaccinationForm(row.horse.id, 'rhino')}
                          disabled={isSaving}
                          title="Vaccination toevoegen"
                        >
                          +
                        </button>
                      </div>

                      <div className="vacc-meta compact">
                        <span><strong>Last:</strong> {formatDate(row.rhinoLast?.administered_on || null)}</span>
                        <span><strong>Due:</strong> {formatDate(row.rhinoLast?.next_due_on || null)}</span>
                        <span>{getDueText(row.rhinoLast?.next_due_on || null)}</span>
                      </div>

                      {isOpenRhinoForm && openForm && (
                        <div className="vacc-entry-form">
                          <div className="vacc-entry-grid">
                            <div className="vacc-entry-field">
                              <label>Date</label>
                              <input
                                type="date"
                                value={openForm.date}
                                onChange={(e) =>
                                  setOpenForm((prev) =>
                                    prev ? { ...prev, date: e.target.value } : prev
                                  )
                                }
                              />
                            </div>

                            <div className="vacc-entry-field">
                              <label>Product</label>
                              <select
                                value={openForm.productName}
                                onChange={(e) =>
                                  setOpenForm((prev) =>
                                    prev ? { ...prev, productName: e.target.value } : prev
                                  )
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
                          </div>

                          <div className="vacc-entry-field">
                            <label>Notes</label>
                            <textarea
                              rows={3}
                              value={openForm.notes}
                              onChange={(e) =>
                                setOpenForm((prev) =>
                                  prev ? { ...prev, notes: e.target.value } : prev
                                )
                              }
                            />
                          </div>

                          <div className="vacc-entry-actions">
                            <button
                              className="vacc-secondary-btn"
                              type="button"
                              onClick={closeVaccinationForm}
                            >
                              Cancel
                            </button>
                            <button
                              className="vacc-save-btn"
                              type="button"
                              onClick={saveVaccinationForm}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="vacc-passport-col compact">
                      <label className="vacc-check-wrap">
                        <input
                          type="checkbox"
                          checked={!row.needsPassportUpdate}
                          onChange={(e) => togglePassportDone(row.horse.id, e.target.checked)}
                          disabled={isSaving}
                        />
                        <span>
                          {!row.needsPassportUpdate
                            ? 'Updated'
                            : 'Needs update'}
                        </span>
                      </label>

                      <span className="vacc-passport-date">
                        {formatDate(row.passportUpdatedAt)}
                      </span>
                    </div>
                  </div>

                  {isHistoryOpen && (
                    <div className="vacc-inline-history-row">
                      <div className="vacc-inline-history-card">
                        <div className="vacc-history-top">
                          <div>
                            <span className="vacc-history-kicker">Vaccination history</span>
                            <h3 className="vacc-history-title">{horseName}</h3>
                          </div>

                          <button
                            className="vacc-close-history"
                            type="button"
                            onClick={() => setOpenHistoryHorseId(null)}
                          >
                            Close
                          </button>
                        </div>

                        {renderHistoryList(horseHistory, false)}
                      </div>
                    </div>
                  )}
                </Fragment>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}