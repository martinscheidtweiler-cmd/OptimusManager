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

export default function MedicinesTab() {
  const [loading, setLoading] = useState(true)

  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [horses, setHorses] = useState<Horse[]>([])
  const [stockRows, setStockRows] = useState<StockRow[]>([])
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([])

  const [search, setSearch] = useState('')
  const [horseSearchAdd, setHorseSearchAdd] = useState('')
  const [horseSearchUsage, setHorseSearchUsage] = useState('')

  const [showAddModal, setShowAddModal] = useState(false)
  const [showUsageModal, setShowUsageModal] = useState(false)
  const [showCreateMedicineInline, setShowCreateMedicineInline] = useState(false)

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
    notes: '',
  })

  const [usageForm, setUsageForm] = useState({
    medicine_id: '',
    usage_date: new Date().toISOString().slice(0, 10),
    quantity: '1',
    horse_scope: 'selected' as 'selected' | 'all',
    selected_horse_ids: [] as string[],
    notes: '',
  })

  async function loadData() {
    setLoading(true)

    const [medicinesRes, horsesRes, stockRes, registerRes] = await Promise.all([
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
    ])

    if (!medicinesRes.error) setMedicines((medicinesRes.data as Medicine[]) || [])
    if (!horsesRes.error) setHorses((horsesRes.data as Horse[]) || [])
    if (!stockRes.error) setStockRows((stockRes.data as StockRow[]) || [])
    if (!registerRes.error) setRegisterRows((registerRes.data as RegisterRow[]) || [])

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

      return [
        row.entry_type,
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

  async function createMedicineInline() {
    if (!medicineInlineForm.name.trim()) {
      alert('Geef een naam van het geneesmiddel op.')
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
    setIssuanceForm((p) => ({ ...p, medicine_id: created.id }))
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
      selected_horse_ids: Array.from(new Set([...prev.selected_horse_ids, ...filteredHorsesAdd.map((h) => h.id)])),
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
      selected_horse_ids: Array.from(new Set([...prev.selected_horse_ids, ...filteredHorsesUsage.map((h) => h.id)])),
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

    const selectedHorseIds =
      issuanceForm.horse_scope === 'all' ? [] : issuanceForm.selected_horse_ids

    if (issuanceForm.horse_scope === 'selected' && selectedHorseIds.length === 0) {
      alert('Selecteer minstens 1 paard.')
      return
    }

    if (issuanceForm.issued_by === 'Other' && !issuanceForm.issued_by_other.trim()) {
      alert('Vul de naam in bij Other.')
      return
    }

    const selectedHorseNames =
      issuanceForm.horse_scope === 'all'
        ? []
        : horses
            .filter((horse) => selectedHorseIds.includes(horse.id))
            .map((horse) => horse.name)

    const { error } = await supabase.from('medicine_issuances').insert({
      medicine_id: issuanceForm.medicine_id,
      issue_date: issuanceForm.issue_date,
      expiry_date: issuanceForm.expiry_date || null,
      lot_number: issuanceForm.lot_number || null,
      issued_by: issuanceForm.issued_by,
      issued_by_other:
        issuanceForm.issued_by === 'Other' ? issuanceForm.issued_by_other.trim() : null,
      quantity: Number(issuanceForm.quantity),
      horse_scope: issuanceForm.horse_scope,
      horse_ids: selectedHorseIds,
      horse_names: selectedHorseNames,
      notes: issuanceForm.notes || null,
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
      notes: '',
    })

    setHorseSearchAdd('')
    setShowAddModal(false)
    await loadData()
  }

  async function handleAddUsage(e: React.FormEvent) {
    e.preventDefault()

    const selectedHorseIds =
      usageForm.horse_scope === 'all' ? [] : usageForm.selected_horse_ids

    if (usageForm.horse_scope === 'selected' && selectedHorseIds.length === 0) {
      alert('Selecteer minstens 1 paard.')
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
      usage_date: usageForm.usage_date,
      quantity: Number(usageForm.quantity),
      horse_scope: usageForm.horse_scope,
      horse_ids: selectedHorseIds,
      horse_names: selectedHorseNames,
      notes: usageForm.notes || null,
    })

    if (error) {
      alert(error.message)
      return
    }

    setUsageForm({
      medicine_id: '',
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
    if (row.issued_by === 'Other') return row.issued_by_other || 'Other'
    return row.issued_by || '—'
  }

  return (
    <div className="med-page">
      <div className="med-topbar">
        <div>
          <span className="med-kicker">Health Management</span>
          <h2 className="med-title">Medicines Register</h2>
          <p className="med-subtitle">
            Registreer afgifte en verbruik van geneesmiddelen en koppel ze direct
            aan actieve paarden uit de horses tabel.
          </p>
        </div>

        <div className="med-actions">
          <button
            className="med-action-icon med-action-plus"
            onClick={() => setShowAddModal(true)}
            aria-label="Afgifte registreren"
          >
            +
          </button>

          <button
            className="med-action-icon med-action-minus"
            onClick={() => setShowUsageModal(true)}
            aria-label="Verbruik registreren"
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
          placeholder="Zoek op middel, lotnummer, paard..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="med-panel med-loading">Loading...</div>
      ) : (
        <>
          <div className="med-summary-grid">
            <div className="med-stat-card">
              <span className="med-stat-label">Geneesmiddelen</span>
              <strong>{medicines.length}</strong>
            </div>

            <div className="med-stat-card">
              <span className="med-stat-label">Actieve paarden</span>
              <strong>{horses.length}</strong>
            </div>

            <div className="med-stat-card">
              <span className="med-stat-label">Registerlijnen</span>
              <strong>{registerRows.length}</strong>
            </div>
          </div>

          <div className="med-panel">
            <div className="med-panel-header">
              <h3>Huidige stock</h3>
            </div>

            <div className="med-table-wrap">
              <table className="med-table">
                <thead>
                  <tr>
                    <th>Geneesmiddel</th>
                    <th>Uitgegeven</th>
                    <th>Verbruikt</th>
                    <th>Stock</th>
                    <th>Eerstvolgende vervaldatum</th>
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
                    <th>Geneesmiddel</th>
                    <th>Datum</th>
                    <th>Vervaldatum</th>
                    <th>Lotnummer</th>
                    <th>Afgegeven door</th>
                    <th>Aantal</th>
                    <th>Paard(en)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegister.map((row) => (
                    <tr key={`${row.entry_type}-${row.id}`}>
                      <td>
                        <span
                          className={
                            row.entry_type === 'issuance'
                              ? 'med-badge'
                              : 'med-badge med-badge-warning'
                          }
                        >
                          {row.entry_type === 'issuance' ? 'Afgifte' : 'Verbruik'}
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
                        {row.notes && <div className="med-muted med-note-inline">{row.notes}</div>}
                      </td>

                      <td>{row.entry_date}</td>
                      <td>{row.expiry_date || '—'}</td>
                      <td>{row.lot_number || '—'}</td>
                      <td>{renderIssuedBy(row)}</td>
                      <td>{row.quantity}</td>
                      <td>
                        {row.horse_scope === 'all' ? (
                          <span className="med-badge med-badge-warning">Alle paarden</span>
                        ) : (
                          <div className="med-horse-list">
                            {row.horse_names.map((horse) => (
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
                        Geen registerlijnen gevonden.
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
        <div className="med-modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="med-modal" onClick={(e) => e.stopPropagation()}>
            <div className="med-modal-header">
              <h3>Afgifte registreren</h3>
              <button className="med-close" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>

            <form className="med-form" onSubmit={handleAddIssuance}>
              <div className="med-form-grid">
                <label>
                  <span>Geneesmiddel</span>
                  <select
                    required
                    value={issuanceForm.medicine_id}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, medicine_id: e.target.value }))
                    }
                  >
                    <option value="">Selecteer geneesmiddel</option>
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
                    onClick={() => setShowCreateMedicineInline((v) => !v)}
                  >
                    {showCreateMedicineInline ? 'Sluit nieuw geneesmiddel' : 'Nieuw geneesmiddel'}
                  </button>
                </div>

                {showCreateMedicineInline && (
                  <div className="med-inline-create med-form-full">
                    <div className="med-inline-create-grid">
                      <label>
                        <span>Naam</span>
                        <input
                          value={medicineInlineForm.name}
                          onChange={(e) =>
                            setMedicineInlineForm((p) => ({ ...p, name: e.target.value }))
                          }
                        />
                      </label>

                      <label>
                        <span>Werkzame stof</span>
                        <input
                          value={medicineInlineForm.active_substance}
                          onChange={(e) =>
                            setMedicineInlineForm((p) => ({
                              ...p,
                              active_substance: e.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        <span>Categorie</span>
                        <select
                          value={medicineInlineForm.category}
                          onChange={(e) =>
                            setMedicineInlineForm((p) => ({ ...p, category: e.target.value }))
                          }
                        >
                          <option value="">Selecteer</option>
                          {CATEGORY_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        <span>Vorm</span>
                        <select
                          value={medicineInlineForm.form}
                          onChange={(e) =>
                            setMedicineInlineForm((p) => ({ ...p, form: e.target.value }))
                          }
                        >
                          <option value="">Selecteer</option>
                          {FORM_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="med-form-full">
                        <span>Notities</span>
                        <textarea
                          rows={3}
                          value={medicineInlineForm.notes}
                          onChange={(e) =>
                            setMedicineInlineForm((p) => ({ ...p, notes: e.target.value }))
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
                        Opslaan en kiezen
                      </button>
                    </div>
                  </div>
                )}

                <label>
                  <span>Datum afgifte</span>
                  <input
                    required
                    type="date"
                    value={issuanceForm.issue_date}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, issue_date: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Vervaldatum</span>
                  <input
                    type="date"
                    value={issuanceForm.expiry_date}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, expiry_date: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Lotnummer</span>
                  <input
                    value={issuanceForm.lot_number}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, lot_number: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Afgegeven door</span>
                  <select
                    value={issuanceForm.issued_by}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({
                        ...p,
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

                {issuanceForm.issued_by === 'Other' && (
                  <label>
                    <span>Andere naam</span>
                    <input
                      value={issuanceForm.issued_by_other}
                      onChange={(e) =>
                        setIssuanceForm((p) => ({ ...p, issued_by_other: e.target.value }))
                      }
                    />
                  </label>
                )}

                <label>
                  <span>Aantal</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={issuanceForm.quantity}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, quantity: e.target.value }))
                    }
                  />
                </label>

                <div className="med-form-full">
                  <span className="med-field-label">Voor welk paard</span>
                  <div className="med-scope-toggle">
                    <button
                      type="button"
                      className={
                        issuanceForm.horse_scope === 'selected'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setIssuanceForm((p) => ({ ...p, horse_scope: 'selected' }))
                      }
                    >
                      Geselecteerde paarden
                    </button>

                    <button
                      type="button"
                      className={
                        issuanceForm.horse_scope === 'all'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setIssuanceForm((p) => ({
                          ...p,
                          horse_scope: 'all',
                          selected_horse_ids: [],
                        }))
                      }
                    >
                      Alle paarden
                    </button>
                  </div>
                </div>

                {issuanceForm.horse_scope === 'selected' && (
                  <div className="med-form-full">
                    <label>
                      <span>Zoek paard</span>
                      <input
                        value={horseSearchAdd}
                        onChange={(e) => setHorseSearchAdd(e.target.value)}
                        placeholder="Zoek op naam..."
                      />
                    </label>

                    <div className="med-horse-picker-tools">
                      <button type="button" className="med-btn med-btn-soft" onClick={selectAllVisibleIssuanceHorses}>
                        Selecteer zichtbare
                      </button>
                      <button type="button" className="med-btn med-btn-soft" onClick={clearIssuanceHorseSelection}>
                        Wis selectie
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
                  <span>Notities</span>
                  <textarea
                    rows={3}
                    value={issuanceForm.notes}
                    onChange={(e) =>
                      setIssuanceForm((p) => ({ ...p, notes: e.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="med-form-actions">
                <button type="button" className="med-btn" onClick={() => setShowAddModal(false)}>
                  Annuleer
                </button>
                <button type="submit" className="med-btn med-btn-gold">
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUsageModal && (
        <div className="med-modal-backdrop" onClick={() => setShowUsageModal(false)}>
          <div className="med-modal" onClick={(e) => e.stopPropagation()}>
            <div className="med-modal-header">
              <h3>Verbruik registreren</h3>
              <button className="med-close" onClick={() => setShowUsageModal(false)}>
                ×
              </button>
            </div>

            <form className="med-form" onSubmit={handleAddUsage}>
              <div className="med-form-grid">
                <label>
                  <span>Geneesmiddel</span>
                  <select
                    required
                    value={usageForm.medicine_id}
                    onChange={(e) =>
                      setUsageForm((p) => ({ ...p, medicine_id: e.target.value }))
                    }
                  >
                    <option value="">Selecteer geneesmiddel</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Datum verbruik</span>
                  <input
                    required
                    type="date"
                    value={usageForm.usage_date}
                    onChange={(e) =>
                      setUsageForm((p) => ({ ...p, usage_date: e.target.value }))
                    }
                  />
                </label>

                <label>
                  <span>Aantal</span>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={usageForm.quantity}
                    onChange={(e) =>
                      setUsageForm((p) => ({ ...p, quantity: e.target.value }))
                    }
                  />
                </label>

                <div className="med-form-full">
                  <span className="med-field-label">Voor welk paard</span>
                  <div className="med-scope-toggle">
                    <button
                      type="button"
                      className={
                        usageForm.horse_scope === 'selected'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() => setUsageForm((p) => ({ ...p, horse_scope: 'selected' }))}
                    >
                      Geselecteerde paarden
                    </button>

                    <button
                      type="button"
                      className={
                        usageForm.horse_scope === 'all'
                          ? 'med-scope-btn active'
                          : 'med-scope-btn'
                      }
                      onClick={() =>
                        setUsageForm((p) => ({
                          ...p,
                          horse_scope: 'all',
                          selected_horse_ids: [],
                        }))
                      }
                    >
                      Alle paarden
                    </button>
                  </div>
                </div>

                {usageForm.horse_scope === 'selected' && (
                  <div className="med-form-full">
                    <label>
                      <span>Zoek paard</span>
                      <input
                        value={horseSearchUsage}
                        onChange={(e) => setHorseSearchUsage(e.target.value)}
                        placeholder="Zoek op naam..."
                      />
                    </label>

                    <div className="med-horse-picker-tools">
                      <button type="button" className="med-btn med-btn-soft" onClick={selectAllVisibleUsageHorses}>
                        Selecteer zichtbare
                      </button>
                      <button type="button" className="med-btn med-btn-soft" onClick={clearUsageHorseSelection}>
                        Wis selectie
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
                  <span>Notities</span>
                  <textarea
                    rows={3}
                    value={usageForm.notes}
                    onChange={(e) => setUsageForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </label>
              </div>

              <div className="med-form-actions">
                <button type="button" className="med-btn" onClick={() => setShowUsageModal(false)}>
                  Annuleer
                </button>
                <button type="submit" className="med-btn med-btn-gold">
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}