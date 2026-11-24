'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLocale } from '../LanguageProvider'
import styles from './VetVisitsTab.module.css'

type Horse = { id: string; name: string; active: boolean | null }
type VetVisit = { id: string; visit_date: string; status: 'planned' | 'done' | 'cancelled'; title: string | null; vet_notes: string | null; followup_on: string | null }
type VetConcern = { id: string; visit_id: string | null; horse_id: string; complaint_date: string; complaint: string; vet_comment: string | null; required_treatment: string | null; followup_on: string | null; action_required: boolean; is_done: boolean; created_at: string }
type StockBatch = { id: string; medicine_id: string; medicine_name: string; remaining_quantity: number; expiry_date: string | null; lot_number: string | null }
type Medicine = { id: string; name: string }
type Usage = { id: string; medicine_id: string; usage_date: string; quantity: number; horse_ids: string[] | null; notes: string | null }
type ReceivedMedicine = { id: string; medicine_id: string; issue_date: string; quantity: number; notes: string | null }
type InvoiceCheck = { id: string; visit_id: string; invoice_file_path: string | null; invoice_file_name: string | null; expected_items: ExpectedItem[]; review_notes: string | null; review_status: 'awaiting_invoice' | 'to_review' | 'matched' | 'discrepancy' }
type ExpectedItem = { label: string; checked: boolean }
type InvoiceReview = { concern: VetConcern; visit: VetVisit }
type Props = { onBack: () => void; initialHorseId?: string; initialDate?: string }

const todayISO = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function displayDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(document.documentElement.lang || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default function VetVisitsTab({ onBack, initialHorseId, initialDate }: Props) {
  useLocale()
  const [horses, setHorses] = useState<Horse[]>([])
  const [visits, setVisits] = useState<VetVisit[]>([])
  const [concerns, setConcerns] = useState<VetConcern[]>([])
  const [stock, setStock] = useState<StockBatch[]>([])
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [usage, setUsage] = useState<Usage[]>([])
  const [received, setReceived] = useState<ReceivedMedicine[]>([])
  const [invoiceChecks, setInvoiceChecks] = useState<InvoiceCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'open' | 'appointments' | 'followup' | 'history'>('open')
  const [showProblemForm, setShowProblemForm] = useState(Boolean(initialHorseId))
  const [problemHorse, setProblemHorse] = useState(initialHorseId || '')
  const [problemText, setProblemText] = useState('')
  const [scheduleConcern, setScheduleConcern] = useState<VetConcern | null>(null)
  const [scheduleDate, setScheduleDate] = useState(initialDate || todayISO())
  const [scheduleVet, setScheduleVet] = useState('')
  const [visitConcern, setVisitConcern] = useState<VetConcern | null>(null)
  const [visitDate, setVisitDate] = useState(initialDate || todayISO())
  const [vetSaid, setVetSaid] = useState('')
  const [doneProcedures, setDoneProcedures] = useState('')
  const [treatment, setTreatment] = useState('')
  const [followupDate, setFollowupDate] = useState('')
  const [resolved, setResolved] = useState(false)
  const [medicineConcern, setMedicineConcern] = useState<VetConcern | null>(null)
  const [medicineBatchId, setMedicineBatchId] = useState('')
  const [medicineQuantity, setMedicineQuantity] = useState('1')
  const [medicineDirections, setMedicineDirections] = useState('')
  const [newMedicineConcern, setNewMedicineConcern] = useState<VetConcern | null>(null)
  const [newMedicineForm, setNewMedicineForm] = useState({ name: '', active: '', form: '', quantity: '1', expiry: '', lot: '' })
  const [invoiceReview, setInvoiceReview] = useState<InvoiceReview | null>(null)
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<ExpectedItem[]>([])
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [invoiceDiscrepancy, setInvoiceDiscrepancy] = useState(false)
  const [invoicePath, setInvoicePath] = useState<string | null>(null)
  const [invoiceName, setInvoiceName] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    const [horseResult, visitResult, concernResult, stockResult, medicineResult, usageResult, receiptResult, invoiceResult] = await Promise.all([
      supabase.from('horses').select('id,name,active').order('name'),
      supabase.from('vet_visits').select('id,visit_date,status,title,vet_notes,followup_on').order('visit_date', { ascending: false }),
      supabase.from('vet_visit_items').select('id,visit_id,horse_id,complaint_date,complaint,vet_comment,required_treatment,followup_on,action_required,is_done,created_at').order('created_at', { ascending: false }),
      supabase.from('medicine_batch_stock_view').select('id,medicine_id,medicine_name,remaining_quantity,expiry_date,lot_number').gt('remaining_quantity', 0).order('medicine_name'),
      supabase.from('medicines').select('id,name').order('name'),
      supabase.from('medicine_usage').select('id,medicine_id,usage_date,quantity,horse_ids,notes').order('usage_date', { ascending: false }).limit(500),
      supabase.from('medicine_issuances').select('id,medicine_id,issue_date,quantity,notes').order('issue_date', { ascending: false }).limit(300),
      supabase.from('optimus_vet_invoice_checks').select('id,visit_id,invoice_file_path,invoice_file_name,expected_items,review_notes,review_status').limit(500),
    ])
    const failed = horseResult.error || visitResult.error || concernResult.error || stockResult.error || medicineResult.error || usageResult.error || receiptResult.error || invoiceResult.error
    if (failed) {
      setError(failed.message)
      setLoading(false)
      return
    }
    setHorses((horseResult.data || []) as Horse[])
    setVisits((visitResult.data || []) as VetVisit[])
    setConcerns((concernResult.data || []) as VetConcern[])
    setStock((stockResult.data || []) as StockBatch[])
    setMedicines((medicineResult.data || []) as Medicine[])
    setUsage((usageResult.data || []) as Usage[])
    setReceived((receiptResult.data || []) as ReceivedMedicine[])
    setInvoiceChecks((invoiceResult.data || []) as InvoiceCheck[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadData() })
    return () => window.cancelAnimationFrame(frame)
  }, [loadData])

  const horseById = useMemo(() => new Map(horses.map((horse) => [horse.id, horse])), [horses])
  const visitById = useMemo(() => new Map(visits.map((visit) => [visit.id, visit])), [visits])
  const medicineById = useMemo(() => new Map(medicines.map((medicine) => [medicine.id, medicine.name])), [medicines])
  const openConcerns = concerns.filter((concern) => !concern.is_done)
  const appointmentConcerns = openConcerns.filter((concern) => concern.visit_id && visitById.get(concern.visit_id)?.status === 'planned')
  const followupConcerns = openConcerns.filter((concern) => concern.followup_on)
  const visibleConcerns = concerns.filter((concern) => {
    if (filter === 'history') return concern.is_done
    if (filter === 'appointments') return Boolean(concern.visit_id && visitById.get(concern.visit_id)?.status === 'planned')
    if (filter === 'followup') return Boolean(concern.followup_on && !concern.is_done)
    return !concern.is_done
  })

  const saveProblem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!problemHorse || !problemText.trim()) return
    setSaving(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.from('vet_visit_items').insert({ horse_id: problemHorse, complaint_date: todayISO(), complaint: problemText.trim(), visit_id: null, vet_comment: null, required_treatment: null, followup_on: null, action_required: false, is_done: false })
    if (saveError) setError(saveError.message)
    else { setProblemText(''); setShowProblemForm(false); setNotice('Problem added.'); await loadData() }
    setSaving(false)
  }

  const scheduleAppointment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!scheduleConcern || !scheduleDate) return
    const horseName = horseById.get(scheduleConcern.horse_id)?.name || 'Horse'
    setSaving(true); setError('')
    const title = [scheduleVet.trim(), horseName, scheduleConcern.complaint].filter(Boolean).join(' · ')
    const { data: visit, error: createError } = await supabase.from('vet_visits').insert({ visit_date: scheduleDate, title, status: 'planned' }).select('id,visit_date,status,title,vet_notes,followup_on').single()
    if (createError) { setError(createError.message); setSaving(false); return }
    const { error: linkError } = await supabase.from('vet_visit_items').update({ visit_id: visit.id }).eq('id', scheduleConcern.id)
    if (linkError) {
      await supabase.from('vet_visits').delete().eq('id', visit.id)
      setError(linkError.message)
    } else {
      setScheduleConcern(null); setNotice('Appointment saved.'); await loadData()
    }
    setSaving(false)
  }

  const openVisitForm = (concern: VetConcern) => {
    setVisitConcern(concern)
    const visit = concern.visit_id ? visitById.get(concern.visit_id) : null
    const invoiceCheck = concern.visit_id ? invoiceChecks.find((item) => item.visit_id === concern.visit_id) : null
    setVisitDate(visit?.visit_date || todayISO())
    setVetSaid(concern.vet_comment || '')
    setDoneProcedures((invoiceCheck?.expected_items || [])
      .filter((item) => !item.label.startsWith('Medication supplied · ') && !item.label.startsWith('Veterinary examination · '))
      .map((item) => item.label.replace(/^Treatment · /, ''))
      .join('\n'))
    setTreatment(concern.required_treatment || '')
    setFollowupDate(concern.followup_on || '')
    setResolved(concern.is_done)
  }

  const saveVisitRecord = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!visitConcern) return
    setSaving(true); setError('')
    let visitId = visitConcern.visit_id
    const horseName = horseById.get(visitConcern.horse_id)?.name || 'Horse'
    const previousItems = visitConcern.visit_id
      ? invoiceChecks.find((item) => item.visit_id === visitConcern.visit_id)?.expected_items || []
      : []
    const performedActions = doneProcedures.split('\n').map((line) => line.trim()).filter(Boolean)
    const expectedItems: ExpectedItem[] = [
      ...performedActions,
      ...previousItems.filter((item) => item.label.startsWith('Medication supplied · ')).map((item) => item.label),
    ].map((label) => ({ label, checked: previousItems.find((item) => item.label === label)?.checked || false }))
    try {
      if (!visitId) {
        const { data, error: createError } = await supabase.from('vet_visits').insert({ visit_date: visitDate, title: `${horseName} · ${visitConcern.complaint}`, status: 'done', vet_notes: vetSaid.trim() || null, followup_on: followupDate || null }).select('id').single()
        if (createError) throw createError
        visitId = data.id
      }
      const { error: concernError } = await supabase.from('vet_visit_items').update({ visit_id: visitId, vet_comment: vetSaid.trim() || null, required_treatment: treatment.trim() || null, followup_on: followupDate || null, action_required: Boolean(treatment.trim() || followupDate), is_done: resolved }).eq('id', visitConcern.id)
      if (concernError) throw concernError
      if (visitConcern.visit_id) {
        const { error: visitError } = await supabase.from('vet_visits').update({ visit_date: visitDate, status: 'done', vet_notes: vetSaid.trim() || null, followup_on: followupDate || null }).eq('id', visitConcern.visit_id)
        if (visitError) throw visitError
      }
      const { error: invoiceError } = await supabase.from('optimus_vet_invoice_checks').upsert({ visit_id: visitId, horse_id: visitConcern.horse_id, expected_items: expectedItems, review_status: 'awaiting_invoice' }, { onConflict: 'visit_id' })
      if (invoiceError) throw invoiceError
      setVisitConcern(null); setNotice('Visit saved. Expected invoice checklist created.'); await loadData()
    } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }

  const logMedication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!medicineConcern || !medicineBatchId) return
    const batch = stock.find((item) => item.id === medicineBatchId)
    const amount = Number(medicineQuantity)
    if (!batch || !Number.isFinite(amount) || amount <= 0 || amount > Number(batch.remaining_quantity)) { setError('Enter a valid quantity within the remaining stock.'); return }
    const horse = horseById.get(medicineConcern.horse_id)
    setSaving(true); setError('')
    const visitDateValue = medicineConcern.visit_id ? visitById.get(medicineConcern.visit_id)?.visit_date : todayISO()
    const { error: saveError } = await supabase.from('medicine_usage').insert({ medicine_id: batch.medicine_id, issuance_id: batch.id, usage_date: visitDateValue || todayISO(), quantity: amount, horse_scope: 'selected', horse_ids: [medicineConcern.horse_id], horse_names: [horse?.name || 'Horse'], notes: `Vet case: ${medicineConcern.id}${medicineDirections.trim() ? ` | ${medicineDirections.trim()}` : ''}` })
    if (saveError) setError(saveError.message)
    else { setMedicineConcern(null); setMedicineBatchId(''); setMedicineQuantity('1'); setMedicineDirections(''); setNotice('Medication linked to this horse and deducted from stock.'); await loadData() }
    setSaving(false)
  }

  const receiveNewMedicine = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newMedicineConcern || !newMedicineForm.name.trim()) return
    const amount = Number(newMedicineForm.quantity)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter a valid quantity.'); return }
    setSaving(true); setError('')
    try {
      const existingMedicine = medicines.find((medicine) => medicine.name.trim().toLowerCase() === newMedicineForm.name.trim().toLowerCase())
      let medicineId = existingMedicine?.id
      if (!medicineId) {
        const { data, error: medicineError } = await supabase.from('medicines').insert({ name: newMedicineForm.name.trim(), active_substance: newMedicineForm.active.trim() || null, category: 'Other', form: newMedicineForm.form.trim() || null, notes: null }).select('id').single()
        if (medicineError) throw medicineError
        medicineId = data.id
      }
      const { error: stockError } = await supabase.from('medicine_issuances').insert({ medicine_id: medicineId, issue_date: todayISO(), expiry_date: newMedicineForm.expiry || null, lot_number: newMedicineForm.lot.trim() || null, issued_by: 'Other', issued_by_other: 'Veterinarian', quantity: amount, horse_scope: 'selected', horse_ids: [newMedicineConcern.horse_id], horse_names: [horseById.get(newMedicineConcern.horse_id)?.name || 'Horse'], storage_location: null, notes: `Vet case: ${newMedicineConcern.id} · Supplied by veterinarian`, stock_source: 'issuance' })
      if (stockError) throw stockError
      if (newMedicineConcern.visit_id) {
        const check = invoiceChecks.find((item) => item.visit_id === newMedicineConcern.visit_id)
        if (check) {
          const label = `Medication supplied · ${newMedicineForm.name.trim()}`
          const expectedItems = check.expected_items.some((item) => item.label === label) ? check.expected_items : [...check.expected_items, { label, checked: false }]
          const { error: checklistError } = await supabase.from('optimus_vet_invoice_checks').update({ expected_items: expectedItems, review_status: 'awaiting_invoice' }).eq('id', check.id)
          if (checklistError) setError(`Medicine was added to stock, but the invoice checklist was not updated: ${checklistError.message}`)
        }
      }
      setNewMedicineConcern(null); setNewMedicineForm({ name: '', active: '', form: '', quantity: '1', expiry: '', lot: '' }); setNotice('Medicine received from the vet and added to stock.'); await loadData()
    } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }

  const openInvoice = async (concern: VetConcern, visit: VetVisit) => {
    const existing = invoiceChecks.find((check) => check.visit_id === visit.id)
    setInvoiceReview({ concern, visit })
    setInvoiceItems(existing?.expected_items || [])
    setInvoiceNotes(existing?.review_notes || '')
    setInvoiceDiscrepancy(existing?.review_status === 'discrepancy')
    setInvoicePath(existing?.invoice_file_path || null)
    setInvoiceName(existing?.invoice_file_name || '')
    setInvoiceFile(null)
  }

  const saveInvoiceReview = async () => {
    if (!invoiceReview) return
    setSaving(true); setError('')
    let path = invoicePath
    try {
      if (invoiceFile) {
        if (invoiceFile.size > 15 * 1024 * 1024) throw new Error('Invoice must be smaller than 15 MB.')
        if (!(invoiceFile.type === 'application/pdf' || invoiceFile.type.startsWith('image/'))) throw new Error('Choose a PDF or image of the invoice.')
        path = `${invoiceReview.visit.id}/${Date.now()}-${invoiceFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('vet-invoices').upload(path, invoiceFile, { upsert: true, contentType: invoiceFile.type })
        if (uploadError) throw uploadError
      }
      const hasUncheckedItems = invoiceItems.some((item) => !item.checked)
      const reviewStatus = !path ? 'awaiting_invoice' : invoiceDiscrepancy ? 'discrepancy' : hasUncheckedItems ? 'to_review' : 'matched'
      const { error: saveError } = await supabase.from('optimus_vet_invoice_checks').upsert({ visit_id: invoiceReview.visit.id, horse_id: invoiceReview.concern.horse_id, invoice_file_path: path, invoice_file_name: invoiceFile?.name || invoiceName || null, expected_items: invoiceItems, review_notes: invoiceNotes.trim() || null, review_status: reviewStatus }, { onConflict: 'visit_id' })
      if (saveError) throw saveError
      setInvoiceReview(null); setNotice(!path ? 'Checklist saved. Upload the invoice when it arrives.' : reviewStatus === 'discrepancy' ? 'Invoice saved with a difference flagged.' : hasUncheckedItems ? 'Invoice saved. Some actions still need checking.' : 'Invoice review saved.'); await loadData()
    } catch (err) { setError(errorMessage(err)) }
    setSaving(false)
  }

  const viewInvoice = async () => {
    if (!invoicePath) return
    const invoiceWindow = window.open('about:blank', '_blank')
    if (!invoiceWindow) { setError('Allow pop-ups to view the invoice.'); return }
    invoiceWindow.opener = null
    const { data, error: linkError } = await supabase.storage.from('vet-invoices').createSignedUrl(invoicePath, 60)
    if (linkError) { invoiceWindow.close(); setError(linkError.message); return }
    invoiceWindow.location.href = data.signedUrl
  }

  const deleteConcern = async (concern: VetConcern) => {
    if (!window.confirm('Remove this concern? This removes its complaint record.')) return
    setSaving(true); setError('')
    const { error: deleteError } = await supabase.from('vet_visit_items').delete().eq('id', concern.id)
    if (deleteError) setError(deleteError.message)
    else await loadData()
    setSaving(false)
  }

  const updateChecked = (index: number, checked: boolean) => setInvoiceItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, checked } : item))
  const statusFor = (concern: VetConcern) => {
    if (concern.is_done) return { label: 'Resolved', style: styles.badgeDone }
    const visit = concern.visit_id ? visitById.get(concern.visit_id) : null
    if (visit?.status === 'planned') return { label: `Appointment · ${displayDate(visit.visit_date)}`, style: styles.badgeBooked }
    if (concern.followup_on) return { label: `Follow-up · ${displayDate(concern.followup_on)}`, style: styles.badgeFollowup }
    return { label: 'Needs appointment', style: styles.badgeOpen }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack}>← Back</button>
      <div><span className={styles.kicker}>VETERINARY CARE</span><h1>Problems & visits</h1><p>One simple record from first concern to invoice check.</p></div>
      <button type="button" className={styles.primary} onClick={() => { setProblemHorse(initialHorseId || ''); setShowProblemForm(true) }}>+ Report a problem</button>
    </header>

    {error && <p className={styles.alert} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
    <section className={styles.summary} aria-label="Veterinary overview">
      <div><strong>{openConcerns.filter((item) => !item.visit_id).length}</strong><span>Needs appointment</span></div>
      <div><strong>{appointmentConcerns.length}</strong><span>Appointments booked</span></div>
      <div><strong>{followupConcerns.length}</strong><span>Follow-ups</span></div>
      <div><strong>{invoiceChecks.filter((item) => item.review_status !== 'matched').length}</strong><span>Invoices to check</span></div>
    </section>

    <nav className={styles.filters} aria-label="Filter veterinary cases">
      {([['open', 'Open problems'], ['appointments', 'Appointments'], ['followup', 'Follow-ups'], ['history', 'History']] as const).map(([value, label]) => <button key={value} type="button" className={filter === value ? styles.filterActive : ''} onClick={() => setFilter(value)}>{label}{value === 'open' && <b>{openConcerns.length}</b>}</button>)}
    </nav>

    {loading ? <p className={styles.empty}>Loading veterinary records…</p> : visibleConcerns.length === 0 ? <section className={styles.emptyCard}><h2>{filter === 'history' ? 'No completed cases yet' : 'Nothing needs attention'}</h2><p>When a horse has a problem, add it here and follow the vet visit through to the invoice.</p><button type="button" className={styles.primary} onClick={() => setShowProblemForm(true)}>+ Report a problem</button></section> : <section className={styles.caseList}>
      {visibleConcerns.map((concern) => {
        const horse = horseById.get(concern.horse_id)
        const visit = concern.visit_id ? visitById.get(concern.visit_id) || null : null
        const status = statusFor(concern)
        const check = visit ? invoiceChecks.find((item) => item.visit_id === visit.id) : null
        const caseUsage = usage.filter((item) => item.notes?.includes(`Vet case: ${concern.id}`))
        const caseReceipts = received.filter((item) => item.notes?.includes(`Vet case: ${concern.id}`))
        return <article className={styles.caseCard} key={concern.id}>
          <div className={styles.caseHead}><div><span className={styles.kicker}>{horse?.name || 'Horse'} · Reported {displayDate(concern.complaint_date)}</span><h2>{concern.complaint}</h2></div><span className={`${styles.badge} ${status.style}`}>{status.label}</span></div>
          <div className={styles.progress}><span className={styles.progressDone}>Problem</span><i/><span className={visit ? styles.progressDone : ''}>Appointment</span><i/><span className={visit?.status === 'done' ? styles.progressDone : ''}>Vet visit</span><i/><span className={check?.invoice_file_path ? styles.progressDone : ''}>Invoice</span></div>
          {(concern.vet_comment || concern.required_treatment || concern.followup_on) && <div className={styles.notesGrid}>{concern.vet_comment && <div><small>Vet said</small><p>{concern.vet_comment}</p></div>}{concern.required_treatment && <div><small>Treatment</small><p>{concern.required_treatment}</p></div>}{concern.followup_on && <div><small>Next check</small><p>{displayDate(concern.followup_on)}</p></div>}</div>}
          {caseUsage.length > 0 && <p className={styles.medicationLine}><b>Medication used:</b> {caseUsage.map((item) => `${medicineById.get(item.medicine_id) || 'Medicine'} (${item.quantity})`).join(', ')}</p>}
          {caseReceipts.length > 0 && <p className={styles.medicationLine}><b>Received from vet:</b> {caseReceipts.map((item) => medicineById.get(item.medicine_id) || 'Medicine').join(', ')}</p>}
          <div className={styles.actions}>
            {!concern.is_done && !visit && <button type="button" className={styles.primary} onClick={() => { setScheduleConcern(concern); setScheduleDate(todayISO()); setScheduleVet('') }}>Schedule vet</button>}
            {!concern.is_done && <button type="button" className={visit?.status === 'done' ? styles.secondary : styles.primary} onClick={() => openVisitForm(concern)}>{visit?.status === 'done' ? 'Edit visit notes' : 'Record vet visit'}</button>}
            {visit?.status === 'done' && <button type="button" className={styles.secondary} onClick={() => { setMedicineConcern(concern); setMedicineBatchId('') }}>Use stock medicine</button>}
            {visit?.status === 'done' && <button type="button" className={styles.secondary} onClick={() => { setNewMedicineConcern(concern); setNewMedicineForm({ name: '', active: '', form: '', quantity: '1', expiry: '', lot: '' }) }}>Add medicine from vet</button>}
            {visit?.status === 'done' && <button type="button" className={check?.review_status === 'matched' ? styles.secondary : styles.invoiceButton} onClick={() => void openInvoice(concern, visit)}>{check?.review_status === 'matched' ? 'Invoice checked' : check?.invoice_file_path ? 'Review invoice' : 'Check invoice'}</button>}
            {!concern.is_done && <button type="button" className={styles.textButton} onClick={() => void deleteConcern(concern)}>Remove</button>}
          </div>
          <details className={styles.caseDetails}><summary>View visit and invoice checklist</summary><div><p><b>Appointment:</b> {visit ? `${displayDate(visit.visit_date)} · ${visit.status}` : 'Not booked yet'}</p>{visit?.vet_notes && <p><b>Visit notes:</b> {visit.vet_notes}</p>}{check?.expected_items?.length ? <div><b>Expected invoice items:</b><ul>{check.expected_items.map((item, index) => <li key={`${item.label}-${index}`}>{item.label}</li>)}</ul></div> : visit?.status === 'done' && <p>Record the visit details to generate the expected invoice checklist.</p>}</div></details>
        </article>
      })}
    </section>}

    {showProblemForm && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowProblemForm(false) }}><form className={styles.dialog} onSubmit={(event) => void saveProblem(event)}><div className={styles.dialogHead}><div><span className={styles.kicker}>NEW CONCERN</span><h2>What is wrong?</h2><p>Choose the horse and write a short note. You can add the appointment later.</p></div><button type="button" className={styles.close} onClick={() => setShowProblemForm(false)}>×</button></div><label>Horse<select required value={problemHorse} onChange={(event) => setProblemHorse(event.target.value)}><option value="">Choose a horse</option>{horses.filter((horse) => horse.active !== false).map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label><label>Problem<textarea required autoFocus value={problemText} onChange={(event) => setProblemText(event.target.value)} placeholder="For example: Signorita — knee swollen after training" rows={3}/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setShowProblemForm(false)}>Cancel</button><button type="submit" className={styles.primary} disabled={saving || !problemHorse || !problemText.trim()}>{saving ? 'Saving…' : 'Save problem'}</button></div></form></div>}

    {scheduleConcern && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setScheduleConcern(null) }}><form className={styles.dialog} onSubmit={(event) => void scheduleAppointment(event)}><div className={styles.dialogHead}><div><span className={styles.kicker}>BOOK APPOINTMENT</span><h2>{horseById.get(scheduleConcern.horse_id)?.name}</h2><p>{scheduleConcern.complaint}</p></div><button type="button" className={styles.close} onClick={() => setScheduleConcern(null)}>×</button></div><label>Appointment date<input autoFocus required type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)}/></label><label>Veterinarian (optional)<input value={scheduleVet} onChange={(event) => setScheduleVet(event.target.value)} placeholder="Name"/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setScheduleConcern(null)}>Cancel</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : 'Save appointment'}</button></div></form></div>}

    {visitConcern && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setVisitConcern(null) }}><form className={styles.dialog} onSubmit={(event) => void saveVisitRecord(event)}><div className={styles.dialogHead}><div><span className={styles.kicker}>VET VISIT · {horseById.get(visitConcern.horse_id)?.name}</span><h2>{visitConcern.complaint}</h2></div><button type="button" className={styles.close} onClick={() => setVisitConcern(null)}>×</button></div><label>Visit date<input autoFocus required type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)}/></label><label>What did the vet say?<textarea value={vetSaid} onChange={(event) => setVetSaid(event.target.value)} rows={2}/></label><label>What did the vet do? <small>Write each actual action on a separate line. Veronique checks these against the invoice.</small><textarea value={doneProcedures} onChange={(event) => setDoneProcedures(event.target.value)} placeholder="Treated Signorita’s left knee&#10;Took an X-ray" rows={3}/></label><label>Treatment plan or care instructions <small>For follow-up at the stable; not added to the invoice checklist.</small><textarea value={treatment} onChange={(event) => setTreatment(event.target.value)} rows={2}/></label><label>Next check (optional)<input type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)}/></label><label className={styles.checkbox}><input type="checkbox" checked={resolved} onChange={(event) => setResolved(event.target.checked)}/> Problem is resolved</label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setVisitConcern(null)}>Cancel</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : 'Save visit & checklist'}</button></div></form></div>}

    {medicineConcern && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMedicineConcern(null) }}><form className={styles.dialog} onSubmit={(event) => void logMedication(event)}><div className={styles.dialogHead}><div><span className={styles.kicker}>MEDICATION FROM STOCK</span><h2>{horseById.get(medicineConcern.horse_id)?.name}</h2></div><button type="button" className={styles.close} onClick={() => setMedicineConcern(null)}>×</button></div><label>Medicine<select required value={medicineBatchId} onChange={(event) => setMedicineBatchId(event.target.value)}><option value="">Choose medicine and batch</option>{stock.map((batch) => <option key={batch.id} value={batch.id}>{batch.medicine_name} · {batch.remaining_quantity} left{batch.expiry_date ? ` · expires ${displayDate(batch.expiry_date)}` : ''}</option>)}</select></label><label>Quantity<input required type="number" min="0.01" step="any" value={medicineQuantity} onChange={(event) => setMedicineQuantity(event.target.value)}/></label><label>Directions / dose (optional)<input value={medicineDirections} onChange={(event) => setMedicineDirections(event.target.value)}/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setMedicineConcern(null)}>Cancel</button><button type="submit" className={styles.primary} disabled={saving || !medicineBatchId}>{saving ? 'Saving…' : 'Link & deduct stock'}</button></div></form></div>}

    {newMedicineConcern && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewMedicineConcern(null) }}><form className={styles.dialog} onSubmit={(event) => void receiveNewMedicine(event)}><div className={styles.dialogHead}><div><span className={styles.kicker}>NEW MEDICINE FROM VET</span><h2>Add it to stock</h2><p>This creates a medicine record and an incoming stock batch.</p></div><button type="button" className={styles.close} onClick={() => setNewMedicineConcern(null)}>×</button></div><label>Medicine name<input autoFocus required value={newMedicineForm.name} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, name: event.target.value })}/></label><label>Active ingredient (optional)<input value={newMedicineForm.active} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, active: event.target.value })}/></label><label>Form (optional)<input value={newMedicineForm.form} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, form: event.target.value })} placeholder="Paste, tablet, injection…"/></label><div className={styles.formRow}><label>Quantity<input required type="number" min="0.01" step="any" value={newMedicineForm.quantity} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, quantity: event.target.value })}/></label><label>Expiry (optional)<input type="date" value={newMedicineForm.expiry} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, expiry: event.target.value })}/></label></div><label>Batch number (optional)<input value={newMedicineForm.lot} onChange={(event) => setNewMedicineForm({ ...newMedicineForm, lot: event.target.value })}/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setNewMedicineConcern(null)}>Cancel</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? 'Saving…' : 'Add medicine to stock'}</button></div></form></div>}

    {invoiceReview && <div className={styles.overlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInvoiceReview(null) }}><section className={`${styles.dialog} ${styles.invoiceDialog}`}><div className={styles.dialogHead}><div><span className={styles.kicker}>INVOICE CONTENT CHECK · {horseById.get(invoiceReview.concern.horse_id)?.name}</span><h2>Check what was done</h2><p>Open the invoice and tick each action you can find. This check is about the work listed, not the prices.</p></div><button type="button" className={styles.close} onClick={() => setInvoiceReview(null)}>×</button></div><div className={styles.invoiceControls}>{invoicePath && <button type="button" className={styles.secondary} onClick={() => void viewInvoice()}>View uploaded invoice</button>}<label className={styles.fileInput}>Upload invoice (PDF, JPG, PNG or WebP)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] || null; setInvoiceFile(file); if (file) setInvoiceName(file.name) }}/></label>{invoiceName && <small>{invoiceName}</small>}</div><h3>Actions recorded for this visit</h3><ul className={styles.invoiceItems}>{invoiceItems.map((item, index) => <li key={`${item.label}-${index}`}><label className={styles.checkbox}><input type="checkbox" checked={item.checked} aria-label={`Found on invoice: ${item.label}`} onChange={(event) => updateChecked(index, event.target.checked)}/><span>{item.label}</span></label></li>)}</ul>{invoiceItems.length === 0 && <p className={styles.empty}>No actions were recorded for this visit yet. Edit the visit and add what the vet did.</p>}<label className={styles.checkbox}><input type="checkbox" checked={invoiceDiscrepancy} onChange={(event) => setInvoiceDiscrepancy(event.target.checked)}/><span>An action is missing from or added to the invoice</span></label><label>Notes for Veronique (optional)<textarea value={invoiceNotes} onChange={(event) => setInvoiceNotes(event.target.value)} rows={2} placeholder="For example: the invoice lists an X-ray, but no X-ray was done"/></label><div className={styles.dialogActions}><button type="button" className={styles.secondary} onClick={() => setInvoiceReview(null)}>Close</button><button type="button" className={styles.primary} disabled={saving || invoiceItems.length === 0} onClick={() => void saveInvoiceReview()}>{saving ? 'Saving…' : 'Save invoice check'}</button></div></section></div>}
  </main>
}
