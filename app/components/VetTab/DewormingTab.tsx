'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './DewormingTab.css'

type Horse = {
  id: string
  name: string | null
  stable_name: string | null
  active: boolean | null
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

type SummaryRow = {
  horse: Horse
  lastRecord: DewormingRecord | null
}

type FilterType = 'all' | 'urgent' | 'done-soon' | 'missing'

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
  date: string
  productName: string
  notes: string
}

type Props = {
  onBack?: () => void
}

const DEWORMING_INTERVAL_DAYS = 90
const DUE_SOON_DAYS = 21

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

function getStatus(lastRecord: DewormingRecord | null) {
  if (!lastRecord || !lastRecord.next_due_on) return 'missing'

  const daysLeft = diffInDays(lastRecord.next_due_on)

  if (daysLeft === null) return 'missing'
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= DUE_SOON_DAYS) return 'due-soon'
  return 'ok'
}

function getStatusLabel(lastRecord: DewormingRecord | null) {
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

function looksLikeDewormer(product: ProductOption) {
  const name = product.name.toLowerCase()
  const category = (product.category || '').toLowerCase()

  return (
    category === 'deworming' ||
    category === 'worming' ||
    category === 'antiparasitic' ||
    name.includes('worm') ||
    name.includes('deworm') ||
    name.includes('ivermectin') ||
    name.includes('moxidectin') ||
    name.includes('fenbendazole') ||
    name.includes('pyrantel') ||
    name.includes('equest') ||
    name.includes('eraquell') ||
    name.includes('eqvalan') ||
    name.includes('panacur') ||
    name.includes('quest') ||
    name.includes('strongid')
  )
}

function batchSortValue(batch: BatchStockRow) {
  if (!batch.expiry_date) return '9999-12-31'
  return batch.expiry_date
}

export default function DewormingTab({ onBack }: Props) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [records, setRecords] = useState<DewormingRecord[]>([])
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

    const [horsesRes, recordsRes, medicinesRes, batchRes] = await Promise.all([
      supabase.from('horses').select('*'),
      supabase.from('deworming_records').select('*').order('administered_on', { ascending: false }),
      supabase.from('medicines').select('*'),
      supabase
        .from('medicine_batch_stock_view')
        .select('*')
        .order('medicine_name', { ascending: true })
        .order('expiry_date', { ascending: true }),
    ])

    const normalizedHorses: Horse[] = (horsesRes.data || [])
      .map((horse: any) => normalizeHorse(horse))
      .filter((horse): horse is Horse => Boolean(horse))
      .filter((horse) => horse.active !== false)
      .sort((a, b) => (a.name || a.stable_name || '').localeCompare(b.name || b.stable_name || ''))

    const normalizedProducts: ProductOption[] = (medicinesRes.data || [])
      .map((row: any) => normalizeMedicine(row))
      .filter((p): p is ProductOption => Boolean(p))
      .filter((p) => looksLikeDewormer(p))
      .sort((a, b) => a.name.localeCompare(b.name))

    setHorses(normalizedHorses)
    setRecords((recordsRes.data || []) as DewormingRecord[])
    setProducts(normalizedProducts)
    setBatchRows((batchRes.data || []) as BatchStockRow[])
    setLoading(false)
  }

  function openDewormingForm(horseId: string) {
    setOpenForm({
      horseId,
      date: toDateInputValue(new Date()),
      productName: products[0]?.name || '',
      notes: '',
    })
  }

  function closeDewormingForm() {
    setOpenForm(null)
  }

  async function saveDewormingForm() {
    if (!openForm) return

    const horse = horses.find((h) => h.id === openForm.horseId)
    const horseName = horse?.name || horse?.stable_name || 'Unnamed horse'

    setSavingHorseId(openForm.horseId)

    const nextDue = addDays(openForm.date, DEWORMING_INTERVAL_DAYS)
    const product = products.find((p) => p.name === openForm.productName) || null

    let chosenBatch: BatchStockRow | null = null

    if (product) {
      const possibleBatches = batchRows
        .filter((b) => b.medicine_id === product.id && Number(b.remaining_quantity) > 0)
        .sort((a, b) => batchSortValue(a).localeCompare(batchSortValue(b)))

      chosenBatch = possibleBatches[0] || null
    }

    const { data: createdDeworming, error: dewormingError } = await supabase
      .from('deworming_records')
      .insert({
        horse_id: openForm.horseId,
        administered_on: openForm.date,
        next_due_on: nextDue,
        product_name: openForm.productName || null,
        notes: openForm.notes || null,
      })
      .select()
      .single()

    if (dewormingError || !createdDeworming) {
      alert(dewormingError?.message || 'Could not save deworming.')
      setSavingHorseId(null)
      return
    }

    if (product && chosenBatch) {
      const usageNotes = openForm.notes?.trim()
        ? `Deworming | ${openForm.notes.trim()}`
        : 'Deworming'

      const { error: usageError } = await supabase
        .from('medicine_usage')
        .insert({
          medicine_id: product.id,
          issuance_id: chosenBatch.id,
          deworming_record_id: createdDeworming.id,
          usage_date: openForm.date,
          quantity: 1,
          horse_scope: 'selected',
          horse_ids: [openForm.horseId],
          horse_names: [horseName],
          notes: usageNotes,
        })

      if (usageError) {
        alert(usageError.message || 'Deworming saved, but stock/register was not updated.')
      }
    } else if (product && !chosenBatch) {
      alert('Deworming saved, but no stock batch with remaining quantity was found for this product.')
    }

    await loadData()
    setSavingHorseId(null)
    setOpenForm(null)
  }

  async function deleteDewormingRecord(recordId: string) {
    const confirmed = window.confirm('Delete this deworming record?')
    if (!confirmed) return

    const { error: usageDeleteError } = await supabase
      .from('medicine_usage')
      .delete()
      .eq('deworming_record_id', recordId)

    if (usageDeleteError) {
      alert(usageDeleteError.message || 'Could not delete linked stock/register line.')
      return
    }

    const { error: deleteError } = await supabase
      .from('deworming_records')
      .delete()
      .eq('id', recordId)

    if (deleteError) {
      alert(deleteError.message || 'Could not delete deworming.')
      return
    }

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
      const lastRecord = horseRecords[0] || null

      return {
        horse,
        lastRecord,
      }
    })
  }, [horses, records])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    const result = summaries.filter((row) => {
      const horseName = (row.horse.name || row.horse.stable_name || '').toLowerCase()
      if (q && !horseName.includes(q)) return false

      const status = getStatus(row.lastRecord)

      if (filter === 'urgent') return status === 'overdue'
      if (filter === 'done-soon') return status === 'due-soon'
      if (filter === 'missing') return status === 'missing'

      return true
    })

    result.sort((a, b) => {
      const aStatus = sortWeight(getStatus(a.lastRecord))
      const bStatus = sortWeight(getStatus(b.lastRecord))

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
    let missing = 0

    summaries.forEach((row) => {
      const status = getStatus(row.lastRecord)
      if (status === 'overdue') overdue += 1
      else if (status === 'due-soon') dueSoon += 1
      else if (status === 'missing') missing += 1
    })

    return {
      total: summaries.length,
      overdue,
      dueSoon,
      missing,
    }
  }, [summaries])

  const allHistoryRecords = useMemo(() => {
    return [...records].sort(
      (a, b) => new Date(b.administered_on).getTime() - new Date(a.administered_on).getTime()
    )
  }, [records])

  function renderHistoryList(historyRecords: DewormingRecord[], showHorseName: boolean) {
    if (historyRecords.length === 0) {
      return <div className="deworm-empty small">No deworming history yet.</div>
    }

    return (
      <div className="deworm-history-list">
        <div className="deworm-history-head">
          <div>{showHorseName ? 'Horse' : 'Date'}</div>
          <div>{showHorseName ? 'Date' : 'Due'}</div>
          <div>{showHorseName ? 'Due' : 'Product'}</div>
          <div>{showHorseName ? 'Product' : 'Notes'}</div>
          <div>{showHorseName ? 'Notes' : ''}</div>
          <div></div>
        </div>

        {historyRecords.map((record) => (
          <div key={record.id} className="deworm-history-item compact">
            {showHorseName ? (
              <>
                <div className="deworm-history-col deworm-history-main">
                  <div className="deworm-history-horse-name-table">
                    {horseNameMap[record.horse_id] || 'Unnamed horse'}
                  </div>
                </div>
                <div className="deworm-history-col">{formatDate(record.administered_on)}</div>
                <div className="deworm-history-col">{formatDate(record.next_due_on)}</div>
                <div className="deworm-history-col deworm-history-product">{record.product_name || '—'}</div>
                <div className="deworm-history-col deworm-history-notes">{record.notes || '—'}</div>
              </>
            ) : (
              <>
                <div className="deworm-history-col">{formatDate(record.administered_on)}</div>
                <div className="deworm-history-col">{formatDate(record.next_due_on)}</div>
                <div className="deworm-history-col deworm-history-product">{record.product_name || '—'}</div>
                <div className="deworm-history-col deworm-history-notes">{record.notes || '—'}</div>
                <div className="deworm-history-col"></div>
              </>
            )}

            <div className="deworm-history-actions">
              <button
                className="deworm-delete-icon-btn"
                type="button"
                onClick={() => deleteDewormingRecord(record.id)}
                title="Delete deworming"
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
    <div className="deworm-page">
      <div className="deworm-topbar">
        <div>
          <span className="deworm-kicker">Health Management</span>
          <h2 className="deworm-title">Deworming</h2>
          <p className="deworm-subtitle">
            Compact overzicht van ontworming, due dates, stockverbruik en history.
          </p>
        </div>

        <div className="deworm-topbar-actions">
          <button
            className="deworm-back-btn"
            type="button"
            onClick={() => setShowAllHistory((prev) => !prev)}
          >
            {showAllHistory ? 'Hide all history' : 'Show all history'}
          </button>

          {onBack && (
            <button className="deworm-back-btn" type="button" onClick={onBack}>
              ← Back
            </button>
          )}
        </div>
      </div>

      <div className="deworm-stats">
        <div className="deworm-stat-card">
          <span className="deworm-stat-label">Active horses</span>
          <strong>{stats.total}</strong>
        </div>

        <div className="deworm-stat-card urgent">
          <span className="deworm-stat-label">Overdue</span>
          <strong>{stats.overdue}</strong>
        </div>

        <div className="deworm-stat-card warning">
          <span className="deworm-stat-label">Due soon</span>
          <strong>{stats.dueSoon}</strong>
        </div>

        <div className="deworm-stat-card neutral">
          <span className="deworm-stat-label">Missing</span>
          <strong>{stats.missing}</strong>
        </div>
      </div>

      <div className="deworm-toolbar">
        <div className="deworm-filters">
          <button className={`deworm-filter-btn ${filter === 'all' ? 'active' : ''}`} type="button" onClick={() => setFilter('all')}>
            All
          </button>
          <button className={`deworm-filter-btn ${filter === 'urgent' ? 'active' : ''}`} type="button" onClick={() => setFilter('urgent')}>
            Overdue
          </button>
          <button className={`deworm-filter-btn ${filter === 'done-soon' ? 'active' : ''}`} type="button" onClick={() => setFilter('done-soon')}>
            Due soon
          </button>
          <button className={`deworm-filter-btn ${filter === 'missing' ? 'active' : ''}`} type="button" onClick={() => setFilter('missing')}>
            Missing
          </button>
        </div>

        <input
          className="deworm-search"
          type="text"
          placeholder="Search horse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showAllHistory && (
        <div className="deworm-history-panel">
          <div className="deworm-history-top">
            <div>
              <span className="deworm-history-kicker">All deworming history</span>
              <h3 className="deworm-history-title">All horses</h3>
            </div>

            <button
              className="deworm-close-history"
              type="button"
              onClick={() => setShowAllHistory(false)}
            >
              Close
            </button>
          </div>

          {renderHistoryList(allHistoryRecords, true)}
        </div>
      )}

      <div className="deworm-table-wrap">
        <div className="deworm-table deworm-list">
          <div className="deworm-row deworm-head deworm-list-head">
            <div>Horse</div>
            <div>Status</div>
            <div>Last date</div>
            <div>Due date</div>
            <div></div>
          </div>

          {loading ? (
            <div className="deworm-empty">Loading...</div>
          ) : filteredRows.length === 0 ? (
            <div className="deworm-empty">No active horses found.</div>
          ) : (
            filteredRows.map((row) => {
              const horseName = row.horse.name || row.horse.stable_name || 'Unnamed horse'
              const status = getStatus(row.lastRecord)
              const isSaving = savingHorseId === row.horse.id
              const horseHistory = allHistoryRecords.filter((r) => r.horse_id === row.horse.id)
              const isHistoryOpen = openHistoryHorseId === row.horse.id
              const isOpenForm = openForm?.horseId === row.horse.id

              return (
                <Fragment key={row.horse.id}>
                  <div className="deworm-row deworm-list-row">
                    <div className="deworm-horse-col">
                      <div className="deworm-horse-main compact">
                        <span className="deworm-horse-name">{horseName}</span>
                        <button
                          className="deworm-history-link"
                          type="button"
                          onClick={() => toggleHorseHistory(row.horse.id)}
                        >
                          {isHistoryOpen ? 'Hide history' : 'View history'}
                        </button>
                      </div>
                    </div>

                    <div className="deworm-cell-block compact">
                      <div className="deworm-cell-top compact">
                        <span className={`deworm-badge ${status}`}>
                          {getStatusLabel(row.lastRecord)}
                        </span>
                      </div>
                      <div className="deworm-meta compact">
                        <span>{getDueText(row.lastRecord?.next_due_on || null)}</span>
                      </div>
                    </div>

                    <div className="deworm-cell-block compact">
                      <div className="deworm-meta compact">
                        <span><strong>Last:</strong> {formatDate(row.lastRecord?.administered_on || null)}</span>
                      </div>
                    </div>

                    <div className="deworm-cell-block compact">
                      <div className="deworm-meta compact">
                        <span><strong>Due:</strong> {formatDate(row.lastRecord?.next_due_on || null)}</span>
                      </div>
                    </div>

                    <div className="deworm-actions-col">
                      <button
                        className="deworm-action-btn"
                        type="button"
                        onClick={() => openDewormingForm(row.horse.id)}
                        disabled={isSaving}
                        title="Deworming toevoegen"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {isOpenForm && openForm && (
                    <div className="deworm-inline-form-row">
                      <div className="deworm-inline-form-card">
                        <div className="deworm-entry-form">
                          <div className="deworm-entry-grid">
                            <div className="deworm-entry-field">
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

                            <div className="deworm-entry-field">
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
                                {products.map((product) => (
                                  <option key={product.id} value={product.name}>
                                    {product.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="deworm-entry-field">
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

                          <div className="deworm-entry-actions">
                            <button
                              className="deworm-secondary-btn"
                              type="button"
                              onClick={closeDewormingForm}
                            >
                              Cancel
                            </button>
                            <button
                              className="deworm-save-btn"
                              type="button"
                              onClick={saveDewormingForm}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isHistoryOpen && (
                    <div className="deworm-inline-history-row">
                      <div className="deworm-inline-history-card">
                        <div className="deworm-history-top">
                          <div>
                            <span className="deworm-history-kicker">Deworming history</span>
                            <h3 className="deworm-history-title">{horseName}</h3>
                          </div>

                          <button
                            className="deworm-close-history"
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