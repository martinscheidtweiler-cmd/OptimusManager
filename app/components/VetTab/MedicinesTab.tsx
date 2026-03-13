'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './MedicinesTab.css'

type Medicine = {
  id: string
  name: string
  active_substance: string | null
  category: string | null
  form: string | null
  notes: string | null
  created_at: string
}

type Horse = {
  id: string
  name: string
  active: boolean
}

type StockRow = {
  id: string
  name: string
  active_substance: string | null
  category: string | null
  form: string | null
  notes: string | null
  total_issued: number
  total_used: number
  current_stock: number
  next_expiry_date: string | null
}

type RegisterRow = {
  id: string
  entry_type: 'issuance' | 'usage'
  stock_source: 'issuance' | 'begin_stock' | 'correction' | null
  medicine_id: string
  medicine_name: string
  active_substance: string | null
  category: string | null
  form: string | null
  entry_date: string
  expiry_date: string | null
  lot_number: string | null
  issued_by: 'Wim Vermeiren' | 'Eveline Van Hove' | 'Apotheek Monen' | 'Other' | null
  issued_by_other: string | null
  quantity: number
  horse_scope: 'selected' | 'all'
  horse_ids: string[]
  horse_names: string[]
  notes: string | null
  storage_location: string | null
  created_at: string
}

type ExpiryWarningRow = {
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
  issued_quantity: number
  used_quantity: number
  remaining_quantity: number
  storage_location: string | null
  notes: string | null
  days_until_expiry: number
  expiry_status: 'expired' | 'expiring_soon' | 'ok'
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

const CATEGORY_OPTIONS = [
  'Anti-inflammatory',
  'Antibiotic',
  'Eye care',
  'Wound care',
  'Sedation',
  'Vaccination',
  'Deworming',
  'Supplements',
  'Other',
]

const FORM_OPTIONS = [
  'Injection',
  'Paste',
  'Powder',
  'Bottle',
  'Tube',
  'Syringe',
  'Tablet',
  'Other',
]

const ISSUED_BY_OPTIONS = [
  'Wim Vermeiren',
  'Eveline Van Hove',
  'Apotheek Monen',
  'Other',
] as const

type IssuanceMode = 'issuance' | 'begin_stock'

export default function MedicinesTab() {
  const [loading, setLoading] = useState(true)

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([])
  const [expiryWarnings, setExpiryWarnings] = useState<ExpiryWarningRow[]>([])
  const [batchRows, setBatchRows] = useState<BatchStockRow[]>([])

  const [search, setSearch] = useState('')
  const [horseSearchAdd, setHorseSearchAdd] = useState('')
  const [horseSearchUsage, setHorseSearchUsage] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [showCreateMedicineInline, setShowCreateMedicineInline] = useState(false)

  const [issuanceMode, setIssuanceMode] = useState<IssuanceMode>('issuance')

  const [medicineInlineForm, setMedicineInlineForm] = useState({
    name: '',
    active_substance: '',
    category: '',
    form: '',
    notes: '',
  })

  const [issuanceForm, setIssuanceForm] = useState({
    medicine_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    expiry_date: '',
    lot_number: '',
    issued_by: 'Wim Vermeiren' as (typeof ISSUED_BY_OPTIONS)[number],
    issued_by_other: '',
    quantity: '1',
    horse_scope: 'selected' as 'selected' | 'all',
    selected_horse_ids: [] as string[],
    storage_location: '',
    notes: '',
  })

  const [usageForm, setUsageForm] = useState({
    medicine_id: '',
    issuance_id: '',
    usage_date: new Date().toISOString().slice(0, 10),
    quantity: '1',
    horse_scope: 'selected' as 'selected' | 'all',
    selected_horse_ids: [] as string[],
    notes: '',
  })

  async function loadData() {
    setLoading(true)

    const [
      medicinesRes,
      horsesRes,
      stockRes,
      registerRes,
      expiryRes,
      batchRes,
    ] = await Promise.all([
      supabase.from('medicines').select('*').order('name', { ascending: true }),

      supabase
        .from('horses')
        .select('id, name, active')
        .eq('active', true)
        .order('name', { ascending: true }),

      supabase.from('medicine_stock_view').select('*').order('name', { ascending: true }),

      supabase
        .from('medicine_register_view')
        .select('*')
        .order('entry_date', { ascending: false })
        .limit(300),

      supabase
        .from('medicine_expiry_warning_view')
        .select('*')
        .order('expiry_date', { ascending: true }),

      supabase
        .from('medicine_batch_stock_view')
        .select('*')
        .order('medicine_name', { ascending: true })
        .order('expiry_date', { ascending: true }),
    ])

    if (!medicinesRes.error) setMedicines((medicinesRes.data as Medicine[]) || [])
    if (!horsesRes.error) setHorses((horsesRes.data as Horse[]) || [])
    if (!stockRes.error) setStockRows((stockRes.data as StockRow[]) || [])
    if (!registerRes.error) setRegisterRows((registerRes.data as RegisterRow[]) || [])
    if (!expiryRes.error) setExpiryWarnings((expiryRes.data as ExpiryWarningRow[]) || [])
    if (!batchRes.error) setBatchRows((batchRes.data as BatchStockRow[]) || [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredRegister = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return registerRows

    return registerRows.filter((row) => {
      const horsesText = row.horse_scope === 'all' ? 'all horses' : row.horse_names.join(' ')
      const giverText =
        row.entry_type === 'issuance'
          ? row.issued_by === 'Other'
            ? row.issued_by_other || ''
            : row.issued_by || ''
          : ''

      const sourceText =
        row.stock_source === 'begin_stock'
          ? 'start stock initial stock'
          : row.stock_source === 'correction'
            ? 'correction'
            : 'delivery issuance'

      return [
        row.entry_type,
        sourceText,
        row.medicine_name,
        row.active_substance,
        row.category,
        row.form,
        row.entry_date,
        row.expiry_date,
        row.lot_number,
        giverText,
        horsesText,
        row.notes,
        row.storage_location,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [registerRows, search])

  const filteredHorsesAdd = useMemo(() => {
    const q = horseSearchAdd.trim().toLowerCase()
    if (!q) return horses
    return horses.filter((horse) => horse.name.toLowerCase().includes(q))
  }, [horses, horseSearchAdd])

  const filteredHorsesUsage = useMemo(() => {
    const q = horseSearchUsage.trim().toLowerCase()
    if (!q) return horses
    return horses.filter((horse) => horse.name.toLowerCase().includes(q))
  }, [horses, horseSearchUsage])

  const filteredUsageBatches = useMemo(() => {
    if (!usageForm.medicine_id) return []

    return batchRows.filter(
      (row) =>
        row.medicine_id === usageForm.medicine_id &&
        Number(row.remaining_quantity) > 0
    )
  }, [batchRows, usageForm.medicine_id])

  const selectedUsageBatch = useMemo(() => {
    if (!usageForm.issuance_id) return null
    return filteredUsageBatches.find((row) => row.id === usageForm.issuance_id) || null
  }, [filteredUsageBatches, usageForm.issuance_id])

  async function createMedicineInline() {
    if (!medicineInlineForm.name.trim()) {
      alert('Please enter a medicine name.')
      return
    }

    const { data, error } = await supabase
      .from('medicines')
      .insert({
        name: medicineInlineForm.name.trim(),
        active_substance: medicineInlineForm.active_substance || null,
        category: medicineInlineForm.category || null,
        form: medicineInlineForm.form || null,
        notes: medicineInlineForm.notes || null,
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    const created = data as Medicine

    setMedicineInlineForm({
      name: '',
      active_substance: '',
      category: '',
      form: '',
      notes: '',
    })

    setShowCreateMedicineInline(false)
    await loadData()
    setIssuanceForm((prev) => ({ ...prev, medicine_id: created.id }))
  }

  function toggleHorseInIssuance(horseId: string) {
    setIssuanceForm((prev) => {
      const exists = prev.selected_horse_ids.includes(horseId)

      return {
        ...prev,
        selected_horse_ids: exists
          ? prev.selected_horse_ids.filter((id) => id !== horseId)
          : [...prev.selected_horse_ids, horseId],
      }
    })
  }

  function toggleHorseInUsage(horseId: string) {
    setUsageForm((prev) => {
      const exists = prev.selected_horse_ids.includes(horseId)

      return {
        ...prev,
        selected_horse_ids: exists
          ? prev.selected_horse_ids.filter((id) => id !== horseId)
          : [...prev.selected_horse_ids, horseId],
      }
    })
  }

  function selectAllVisibleIssuanceHorses() {
    setIssuanceForm((prev) => ({
      ...prev,
      selected_horse_ids: Array.from(
        new Set([...prev.selected_horse_ids, ...filteredHorsesAdd.map((h) => h.id)])
      ),
    }))
  }

  function clearIssuanceHorseSelection() {
    setIssuanceForm((prev) => ({
      ...prev,
      selected_horse_ids: [],
    }))
  }

  function selectAllVisibleUsageHorses() {
    setUsageForm((prev) => ({
      ...prev,
      selected_horse_ids: Array.from(
        new Set([...prev.selected_horse_ids, ...filteredHorsesUsage.map((h) => h.id)])
      ),
    }))
  }

  function clearUsageHorseSelection() {
    setUsageForm((prev) => ({
      ...prev,
      selected_horse_ids: [],
    }))
  }

  async function handleAddIssuance(e: React.FormEvent) {
    e.preventDefault()

    if (!issuanceForm.medicine_id) {
      alert('Please select a medicine.')
      return
    }

    const quantityNumber = Number(issuanceForm.quantity)
    if (!quantityNumber || quantityNumber <= 0) {
      alert('Please enter a valid quantity.')
      return
    }

    const selectedHorseIds =
      issuanceForm.horse_scope === 'all' ? [] : issuanceForm.selected_horse_ids

    if (
      issuanceMode === 'issuance' &&
      issuanceForm.horse_scope === 'selected' &&
      selectedHorseIds.length === 0
    ) {
      alert('Please select at least 1 horse.')
      return
    }

    if (
      issuanceMode === 'issuance' &&
      issuanceForm.issued_by === 'Other' &&
      !issuanceForm.issued_by_other.trim()
    ) {
      alert('Please enter the name for Other.')
      return
    }

    const selectedHorseNames =
      issuanceForm.horse_scope === 'all'
        ? []
        : horses
            .filter((horse) => selectedHorseIds.includes(horse.id))
            .map((horse) => horse.name)

    const startStockNote =
      'Stock already present when the system started. Exact delivery date unknown.'

    const finalNotes =
      issuanceMode === 'begin_stock'
        ? issuanceForm.notes.trim()
          ? `${issuanceForm.notes.trim()} | ${startStockNote}`
          : startStockNote
        : issuanceForm.notes.trim() || null

    const { error } = await supabase.from('medicine_issuances').insert({
      medicine_id: issuanceForm.medicine_id,
      issue_date: issuanceForm.issue_date,
      expiry_date: issuanceForm.expiry_date || null,
      lot_number: issuanceForm.lot_number || null,
      issued_by: issuanceMode === 'begin_stock' ? null : issuanceForm.issued_by,
      issued_by_other:
        issuanceMode === 'begin_stock'
          ? null
          : issuanceForm.issued_by === 'Other'
            ? issuanceForm.issued_by_other.trim()
            : null,
      quantity: quantityNumber,
      horse_scope: issuanceForm.horse_scope,
      horse_ids: selectedHorseIds,
      horse_names: selectedHorseNames,
      storage_location: issuanceForm.storage_location || null,
      notes: finalNotes,
      stock_source: issuanceMode,
    })

    if (error) {
      alert(error.message)
      return
    }

    setIssuanceForm({
      medicine_id: '',
      issue_date: new Date().toISOString().slice(0, 10),
      expiry_date: '',
      lot_number: '',
      issued_by: 'Wim Vermeiren',
      issued_by_other: '',
      quantity: '1',
      horse_scope: 'selected',
      selected_horse_ids: [],
      storage_location: '',
      notes: '',
    })

    setHorseSearchAdd('')
    setIssuanceMode('issuance')
    setShowAddModal(false)
    await loadData()
  }

  async function handleAddUsage(e: React.FormEvent) {
    e.preventDefault()

    if (!usageForm.medicine_id) {
      alert('Please select a medicine.')
      return
    }

    if (!usageForm.issuance_id) {
      alert('Please select a batch.')
      return
    }

    const quantityNumber = Number(usageForm.quantity)
    if (!quantityNumber || quantityNumber <= 0) {
      alert('Please enter a valid quantity.')
      return
    }

    if (selectedUsageBatch && quantityNumber > Number(selectedUsageBatch.remaining_quantity)) {
      alert(`Only ${selectedUsageBatch.remaining_quantity} left in this batch.`)
      return
    }

    const selectedHorseIds =
      usageForm.horse_scope === 'all' ? [] : usageForm.selected_horse_ids

    if (usageForm.horse_scope === 'selected' && selectedHorseIds.length === 0) {
      alert('Please select at least 1 horse.')
      return
    }

    const selectedHorseNames =
      usageForm.horse_scope === 'all'
        ? []
        : horses
            .filter((horse) => selectedHorseIds.includes(horse.id))
            .map((horse) => horse.name)

    const { error } = await supabase.from('medicine_usage').insert({
      medicine_id: usageForm.medicine_id,
      issuance_id: usageForm.issuance_id,
      usage_date: usageForm.usage_date,
      quantity: quantityNumber,
      horse_scope: usageForm.horse_scope,
      horse_ids: selectedHorseIds,
      horse_names: selectedHorseNames,
      notes: usageForm.notes.trim() || null,
    })

    if (error) {
      alert(error.message)
      return
    }

    setUsageForm({
      medicine_id: '',
      issuance_id: '',
      usage_date: new Date().toISOString().slice(0, 10),
      quantity: '1',
      horse_scope: 'selected',
      selected_horse_ids: [],
      notes: '',
    })

    setHorseSearchUsage('')
    setShowUsageModal(false)
    await loadData()
  }

  function renderIssuedBy(row: RegisterRow) {
    if (row.entry_type !== 'issuance') return '—'
    if (row.stock_source === 'begin_stock') return '—'
    if (row.issued_by === 'Other') return row.issued_by_other || 'Other'
    return row.issued_by || '—'
  }

  function getRegisterTypeLabel(row: RegisterRow) {
    if (row.entry_type === 'usage') return 'Usage'
    if (row.stock_source === 'begin_stock') return 'Start stock'
    if (row.stock_source === 'correction') return 'Correction'
    return 'Delivery'
  }

  function getRegisterTypeClass(row: RegisterRow) {
    if (row.entry_type === 'usage') return 'med-badge med-badge-warning'
    if (row.stock_source === 'begin_stock') return 'med-badge med-badge-gold'
    if (row.stock_source === 'correction') return 'med-badge med-badge-soft'
    return 'med-badge'
  }

  function closeAddModal() {
    setShowAddModal(false)
    setShowCreateMedicineInline(false)
    setIssuanceMode('issuance')
  }

  function closeUsageModal() {
    setShowUsageModal(false)
    setUsageForm({
      medicine_id: '',
      issuance_id: '',
      usage_date: new Date().toISOString().slice(0, 10),
      quantity: '1',
      horse_scope: 'selected',
      selected_horse_ids: [],
      notes: '',
    })
    setHorseSearchUsage('')
  }

  return (
    <div className="med-page">
      <div className="med-topbar">
        <div>
          <span className="med-kicker">Health Management</span>
          <h2 className="med-title">Medicines Register</h2>
          <p className="med-subtitle">
            Track medicine delivery, start stock, and usage for active horses.
          </p>
        </div>

        <div className="med-actions">
          <button
            className="med-action-icon med-action-plus"
            onClick={() => setShowAddModal(true)}
            aria-label="Register delivery or start stock"
          >
            +
          </button>

          <button
            className="med-action-icon med-action-minus"
            onClick={() => setShowUsageModal(true)}
            aria-label="Register usage"
          >
            −
          </button>

          <button className="med-btn" onClick={() => window.print()}>
            Print register
          </button>
        </div>
      </div>

      <div className="med-toolbar">
        <input
          className="med-search"
          placeholder="Search by medicine, lot number, horse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="med-panel med-loading">Loading...</div>
      ) : (
        <>
          {expiryWarnings.length > 0 && (
            <div className="med-panel med-warning-panel">
              <div className="med-panel-header">
                <h3>Expiry warning</h3>
              </div>

              <div className="med-warning-list">
                {expiryWarnings.map((row) => (
                  <div key={row.id} className="med-warning-item">
                    <div className="med-warning-main">
                      <strong>{row.medicine_name}</strong>
                      <span
                        className={
                          row.expiry_status === 'expired'
                            ? 'med-expired'
                            : 'med-expiring'
                        }
                      >
                        {row.expiry_status === 'expired'
                          ? 'Expired'
                          : `${row.days_until_expiry} days left`}
                      </span>
                    </div>

                    <div className="med-warning-meta">
                      Expiry date: {row.expiry_date || '—'}
                      {row.lot_number ? ` · Lot: ${row.lot_number}` : ''}
                      {row.storage_location ? ` · Location: ${row.storage_location}` : ''}
                      {typeof row.remaining_quantity === 'number'
                        ? ` · Remaining: ${row.remaining_quantity}`
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="med-panel">
            <div className="med-panel-header">
              <h3>Current stock</h3>
            </div>

            <div className="med-table-wrap">
              <table className="med-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Delivered</th>
                    <th>Used</th>
                    <th>Stock</th>
                    <th>Next expiry date</th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="med-main">{row.name}</div>
                        {(row.active_substance || row.form || row.category) && (
                          <div className="med-muted">
                            {[row.active_substance, row.form, row.category]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td>{row.total_issued ?? 0}</td>
                      <td>{row.total_used ?? 0}</td>
                      <td>
                        <span
                          className={
                            Number(row.current_stock) <= 1
                              ? 'med-badge med-badge-warning'
                              : 'med-badge'
                          }
                        >
                          {row.current_stock ?? 0}
                        </span>
                      </td>
                      <td>{row.next_expiry_date || '—'}</td>
                    </tr>
                  ))}

                  {stockRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="med-empty">
                        No stock lines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="med-panel">
            <div className="med-panel-header">
              <h3>Register</h3>
            </div>

            <div className="med-table-wrap">
              <table className="med-table med-table-register">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Medicine</th>
                    <th>Date</th>
                    <th>Expiry date</th>
                    <th>Lot number</th>
                    <th>Given by</th>
                    <th>Quantity</th>
                    <th>Horse(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegister.map((row) => (
                    <tr key={`${row.entry_type}-${row.id}`}>
                      <td>
                        <span className={getRegisterTypeClass(row)}>
                          {getRegisterTypeLabel(row)}
                        </span>
                      </td>

                      <td>
                        <div className="med-main">{row.medicine_name}</div>

                        {(row.active_substance || row.form || row.category) && (
                          <div className="med-muted">
                            {[row.active_substance, row.form, row.category]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}

                        {row.storage_location && (
                          <div className="med-muted">Location: {row.storage_location}</div>
                        )}

                        {row.notes && (
                          <div className="med-muted med-note-inline">{row.notes}</div>
                        )}
                      </td>

                      <td>{row.entry_date}</td>
                      <td>{row.expiry_date || '—'}</td>
                      <td>{row.lot_number || '—'}</td>
                      <td>{renderIssuedBy(row)}</td>
                      <td>{row.quantity}</td>
                      <td>
                        {row.horse_scope === 'all' ? (
                          <span className="med-badge med-badge-warning">All horses</span>
                        ) : (
                          <div className="med-horse-list">
                            {row.horse_names?.map((horse) => (
                              <span className="med-horse-chip" key={horse}>
                                {horse}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredRegister.length === 0 && (
                    <tr>
                      <td colSpan={8} className="med-empty">
                        No register lines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <div className="med-modal-backdrop" onClick={closeAddModal}>
          <div className="med-modal" onClick={(e) => e.stopPropagation()}>
            <div className="med-modal-header">
              <h3>
                {issuanceMode === 'begin_stock'
                  ? 'Register start stock'
                  : 'Register delivery'}
              </h3>
              <button className="med-close" onClick={closeAddModal}>
                ×
              </button>
            </div>

            <form className="med-form" onSubmit={handleAddIssuance}>
              <div className="med-form-grid">
                <div className="med-form-full">
                  <span className="med-field-label">Type</span>
                  <div className="med-scope-toggle">
                    <button
                      type="button"
                      className={
                        issuanceMode === 'issuance'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() => setIssuanceMode('issuance')}
                    >
                      + Delivery
                    </button>

                    <button
                      type="button"
                      className={
                        issuanceMode === 'begin_stock'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() => setIssuanceMode('begin_stock')}
                    >
                      + Start stock
                    </button>
                  </div>
                </div>

                <label>
                  <span>Medicine</span>
                  <select
                    required
                    value={issuanceForm.medicine_id}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        medicine_id: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select medicine</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="med-inline-create-wrap">
                  <button
                    type="button"
                    className="med-btn med-btn-soft"
                    onClick={() => setShowCreateMedicineInline((prev) => !prev)}
                  >
                    {showCreateMedicineInline ? 'Close new medicine' : 'New medicine'}
                  </button>
                </div>

                {showCreateMedicineInline && (
                  <div className="med-inline-create med-form-full">
                    <div className="med-inline-create-grid">
                      <label>
                        <span>Medicine name</span>
                        <input
                          value={medicineInlineForm.name}
                          onChange={(e) =>
                            setMedicineInlineForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        <span>Active substance</span>
                        <input
                          value={medicineInlineForm.active_substance}
                          onChange={(e) =>
                            setMedicineInlineForm((prev) => ({
                              ...prev,
                              active_substance: e.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        <span>Category</span>
                        <select
                          value={medicineInlineForm.category}
                          onChange={(e) =>
                            setMedicineInlineForm((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select</option>
                          {CATEGORY_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Form</span>
                        <select
                          value={medicineInlineForm.form}
                          onChange={(e) =>
                            setMedicineInlineForm((prev) => ({
                              ...prev,
                              form: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select</option>
                          {FORM_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="med-form-full">
                        <span>Notes</span>
                        <textarea
                          rows={3}
                          value={medicineInlineForm.notes}
                          onChange={(e) =>
                            setMedicineInlineForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="med-inline-create-actions">
                      <button
                        type="button"
                        className="med-btn med-btn-gold"
                        onClick={createMedicineInline}
                      >
                        Save and select
                      </button>
                    </div>
                  </div>
                )}

                <label>
                  <span>{issuanceMode === 'begin_stock' ? 'Date' : 'Delivery date'}</span>
                  <input
                    required
                    type="date"
                    value={issuanceForm.issue_date}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        issue_date: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Expiry date</span>
                  <input
                    type="date"
                    value={issuanceForm.expiry_date}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        expiry_date: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Lot number</span>
                  <input
                    value={issuanceForm.lot_number}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        lot_number: e.target.value,
                      }))
                    }
                    placeholder="Unknown"
                  />
                </label>

                {issuanceMode === 'issuance' && (
                  <label>
                    <span>Given by</span>
                    <select
                      value={issuanceForm.issued_by}
                      onChange={(e) =>
                        setIssuanceForm((prev) => ({
                          ...prev,
                          issued_by: e.target.value as (typeof ISSUED_BY_OPTIONS)[number],
                        }))
                      }
                    >
                      {ISSUED_BY_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {issuanceMode === 'issuance' && issuanceForm.issued_by === 'Other' && (
                  <label>
                    <span>Other name</span>
                    <input
                      value={issuanceForm.issued_by_other}
                      onChange={(e) =>
                        setIssuanceForm((prev) => ({
                          ...prev,
                          issued_by_other: e.target.value,
                        }))
                      }
                    />
                  </label>
                )}

                <label>
                  <span>Quantity</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={issuanceForm.quantity}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Storage location</span>
                  <input
                    value={issuanceForm.storage_location}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        storage_location: e.target.value,
                      }))
                    }
                    placeholder="Cabinet / fridge / office"
                  />
                </label>

                <div className="med-form-full">
                  <span className="med-field-label">For which horse</span>
                  <div className="med-scope-toggle">
                    <button
                      type="button"
                      className={
                        issuanceForm.horse_scope === 'selected'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setIssuanceForm((prev) => ({
                          ...prev,
                          horse_scope: 'selected',
                        }))
                      }
                    >
                      Selected horses
                    </button>

                    <button
                      type="button"
                      className={
                        issuanceForm.horse_scope === 'all'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setIssuanceForm((prev) => ({
                          ...prev,
                          horse_scope: 'all',
                          selected_horse_ids: [],
                        }))
                      }
                    >
                      All horses
                    </button>
                  </div>
                </div>

                {issuanceForm.horse_scope === 'selected' && (
                  <div className="med-form-full">
                    <label>
                      <span>Search horse</span>
                      <input
                        value={horseSearchAdd}
                        onChange={(e) => setHorseSearchAdd(e.target.value)}
                        placeholder="Search by name..."
                      />
                    </label>

                    <div className="med-horse-picker-tools">
                      <button
                        type="button"
                        className="med-btn med-btn-soft"
                        onClick={selectAllVisibleIssuanceHorses}
                      >
                        Select visible
                      </button>
                      <button
                        type="button"
                        className="med-btn med-btn-soft"
                        onClick={clearIssuanceHorseSelection}
                      >
                        Clear selection
                      </button>
                    </div>

                    <div className="med-horse-grid">
                      {filteredHorsesAdd.map((horse) => {
                        const active = issuanceForm.selected_horse_ids.includes(horse.id)

                        return (
                          <label
                            key={horse.id}
                            className={active ? 'med-horse-row active' : 'med-horse-row'}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleHorseInIssuance(horse.id)}
                            />
                            <span>{horse.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <label className="med-form-full">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={issuanceForm.notes}
                    onChange={(e) =>
                      setIssuanceForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    placeholder={
                      issuanceMode === 'begin_stock'
                        ? 'Example: Stock already present when the system started'
                        : ''
                    }
                  />
                </label>
              </div>

              <div className="med-form-actions">
                <button type="button" className="med-btn" onClick={closeAddModal}>
                  Cancel
                </button>
                <button type="submit" className="med-btn med-btn-gold">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsageModal && (
        <div className="med-modal-backdrop" onClick={closeUsageModal}>
          <div className="med-modal" onClick={(e) => e.stopPropagation()}>
            <div className="med-modal-header">
              <h3>Register usage</h3>
              <button className="med-close" onClick={closeUsageModal}>
                ×
              </button>
            </div>

            <form className="med-form" onSubmit={handleAddUsage}>
              <div className="med-form-grid">
                <label>
                  <span>Medicine</span>
                  <select
                    required
                    value={usageForm.medicine_id}
                    onChange={(e) =>
                      setUsageForm((prev) => ({
                        ...prev,
                        medicine_id: e.target.value,
                        issuance_id: '',
                      }))
                    }
                  >
                    <option value="">Select medicine</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Batch / lot</span>
                  <select
                    required
                    value={usageForm.issuance_id}
                    onChange={(e) =>
                      setUsageForm((prev) => ({
                        ...prev,
                        issuance_id: e.target.value,
                      }))
                    }
                    disabled={!usageForm.medicine_id}
                  >
                    <option value="">
                      {usageForm.medicine_id ? 'Select batch' : 'Select medicine first'}
                    </option>

                    {filteredUsageBatches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.lot_number || 'No lot'}{' '}
                        {batch.expiry_date ? `• exp ${batch.expiry_date}` : '• no expiry'}{' '}
                        • {batch.remaining_quantity} left
                      </option>
                    ))}
                  </select>
                </label>

                {selectedUsageBatch && (
                  <div className="med-form-full">
                    <div className="med-inline-create">
                      <div className="med-main">{selectedUsageBatch.medicine_name}</div>
                      <div className="med-muted">
                        Lot: {selectedUsageBatch.lot_number || '—'} · Expiry:{' '}
                        {selectedUsageBatch.expiry_date || '—'} · Remaining:{' '}
                        {selectedUsageBatch.remaining_quantity}
                        {selectedUsageBatch.storage_location
                          ? ` · Location: ${selectedUsageBatch.storage_location}`
                          : ''}
                      </div>
                    </div>
                  </div>
                )}

                <label>
                  <span>Usage date</span>
                  <input
                    required
                    type="date"
                    value={usageForm.usage_date}
                    onChange={(e) =>
                      setUsageForm((prev) => ({
                        ...prev,
                        usage_date: e.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Quantity</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={usageForm.quantity}
                    onChange={(e) =>
                      setUsageForm((prev) => ({
                        ...prev,
                        quantity: e.target.value,
                      }))
                    }
                  />
                </label>

                <div className="med-form-full">
                  <span className="med-field-label">For which horse</span>
                  <div className="med-scope-toggle">
                    <button
                      type="button"
                      className={
                        usageForm.horse_scope === 'selected'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setUsageForm((prev) => ({
                          ...prev,
                          horse_scope: 'selected',
                        }))
                      }
                    >
                      Selected horses
                    </button>

                    <button
                      type="button"
                      className={
                        usageForm.horse_scope === 'all'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setUsageForm((prev) => ({
                          ...prev,
                          horse_scope: 'all',
                          selected_horse_ids: [],
                        }))
                      }
                    >
                      All horses
                    </button>
                  </div>
                </div>

                {usageForm.horse_scope === 'selected' && (
                  <div className="med-form-full">
                    <label>
                      <span>Search horse</span>
                      <input
                        value={horseSearchUsage}
                        onChange={(e) => setHorseSearchUsage(e.target.value)}
                        placeholder="Search by name..."
                      />
                    </label>

                    <div className="med-horse-picker-tools">
                      <button
                        type="button"
                        className="med-btn med-btn-soft"
                        onClick={selectAllVisibleUsageHorses}
                      >
                        Select visible
                      </button>
                      <button
                        type="button"
                        className="med-btn med-btn-soft"
                        onClick={clearUsageHorseSelection}
                      >
                        Clear selection
                      </button>
                    </div>

                    <div className="med-horse-grid">
                      {filteredHorsesUsage.map((horse) => {
                        const active = usageForm.selected_horse_ids.includes(horse.id)

                        return (
                          <label
                            key={horse.id}
                            className={active ? 'med-horse-row active' : 'med-horse-row'}
                          >
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => toggleHorseInUsage(horse.id)}
                            />
                            <span>{horse.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                <label className="med-form-full">
                  <span>Notes</span>
                  <textarea
                    rows={3}
                    value={usageForm.notes}
                    onChange={(e) =>
                      setUsageForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="med-form-actions">
                <button type="button" className="med-btn" onClick={closeUsageModal}>
                  Cancel
                </button>
                <button type="submit" className="med-btn med-btn-gold">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}