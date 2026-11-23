'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLocale } from '../LanguageProvider'
import styles from './VetTab.module.css'
import XraysTab from './XraysTab'
import LabResultsTab from './LabResultsTab'
import VetVisitsTab from './VetVisitsTab'
import MedicinesTab from './MedicinesTab'
import VaccinationsTab from './VaccinationsTab'
import DewormingTab from './DewormingTab'
import CareTab from '../CareTab/CareTab'

type VetMenu = 'Visits' | 'Xray' | 'Lab Results' | 'Vaccinations' | 'Deworming' | 'Medicines' | 'Breeding'
type InitialRequest = { menu: 'Vaccinations' | 'Deworming' | 'Visits'; horseId: string; vaccineType?: 'flu_tetanus' | 'rhino' } | null
type Horse = { id: string; name: string; active: boolean | null }
type PreventiveRecord = { id: string; horse_id: string; vaccine_type?: string; administered_on: string; next_due_on: string | null }
type FollowUp = { id: string; horse_id: string; complaint: string; followup_on: string | null; action_required: boolean; is_done: boolean }
type VetAppointment = { id: string; visit_date: string; status: 'planned' | 'done' | 'cancelled'; title: string | null }
type ExpiryAlert = { id: string; medicine_name: string; expiry_date: string | null; expiry_status: 'expired' | 'expiring_soon' | 'ok'; days_until_expiry: number }
type QueueItem = { id: string; horse: string; horseId?: string; kind: string; detail: string; due: string; menu: VetMenu; vaccineType?: 'flu_tetanus' | 'rhino'; initialDate?: string; level: 'overdue' | 'upcoming' }

function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function plusDaysISO(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(document.documentElement.lang || 'en-GB', { day: 'numeric', month: 'short' })
}

export default function VetTab({ initialRequest = null }: { initialRequest?: InitialRequest }) {
  useLocale()
  const [activeMenu, setActiveMenu] = useState<VetMenu | null>(initialRequest?.menu || null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [horses, setHorses] = useState<Horse[]>([])
  const [vaccinations, setVaccinations] = useState<PreventiveRecord[]>([])
  const [deworming, setDeworming] = useState<PreventiveRecord[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [appointments, setAppointments] = useState<VetAppointment[]>([])
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([])
  const [quickStartMenu, setQuickStartMenu] = useState<VetMenu | null>(null)
  const [quickStartHorseId, setQuickStartHorseId] = useState('')
  const [entryHorseId, setEntryHorseId] = useState<string | null>(initialRequest?.horseId || null)
  const [entryVaccineType, setEntryVaccineType] = useState<'flu_tetanus' | 'rhino'>(initialRequest?.vaccineType || 'flu_tetanus')
  const [entryDate, setEntryDate] = useState<string | null>(null)

  const loadOverview = useCallback(async () => {
    const [horseResult, vaccinationResult, dewormingResult, followUpResult, appointmentResult, expiryResult] = await Promise.all([
      supabase.from('horses').select('id,name,active').eq('active', true).order('name'),
      supabase.from('vaccination_records').select('id,horse_id,vaccine_type,administered_on,next_due_on').order('administered_on', { ascending: false }).limit(2000),
      supabase.from('deworming_records').select('id,horse_id,administered_on,next_due_on').order('administered_on', { ascending: false }).limit(2000),
      supabase.from('vet_visit_items').select('id,horse_id,complaint,followup_on,action_required,is_done').order('created_at', { ascending: false }).limit(2000),
      supabase.from('vet_visits').select('id,visit_date,status,title').eq('status', 'planned').order('visit_date').limit(300),
      supabase.from('medicine_expiry_warning_view').select('id,medicine_name,expiry_date,expiry_status,days_until_expiry').in('expiry_status', ['expired', 'expiring_soon']).order('expiry_date').limit(100),
    ])
    const firstError = horseResult.error || vaccinationResult.error || dewormingResult.error || followUpResult.error || appointmentResult.error || expiryResult.error
    if (firstError) {
      setLoadError('Health overview could not be loaded. Try again.')
      setLoading(false)
      return
    }
    setHorses((horseResult.data || []) as Horse[])
    setVaccinations((vaccinationResult.data || []) as PreventiveRecord[])
    setDeworming((dewormingResult.data || []) as PreventiveRecord[])
    setFollowUps((followUpResult.data || []) as FollowUp[])
    setAppointments((appointmentResult.data || []) as VetAppointment[])
    setExpiryAlerts((expiryResult.data || []) as ExpiryAlert[])
    setLoading(false)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void loadOverview() })
    return () => window.cancelAnimationFrame(frame)
  }, [loadOverview])

  const queue = useMemo(() => {
    const today = localDate()
    const horizon = plusDaysISO(30)
    const horseNames = new Map(horses.map((horse) => [horse.id, horse.name]))
    const items: QueueItem[] = []

    const latestBy = <T extends PreventiveRecord>(records: T[], keyFor: (record: T) => string) => {
      const result = new Map<string, T>()
      for (const record of records) {
        const key = keyFor(record)
        if (!result.has(key)) result.set(key, record)
      }
      return result.values()
    }

    for (const record of latestBy(vaccinations, (item) => `${item.horse_id}:${item.vaccine_type || 'vaccine'}`)) {
      if (!record.next_due_on || record.next_due_on > horizon || !horseNames.has(record.horse_id)) continue
      const vaccineType = record.vaccine_type === 'rhino' ? 'rhino' : 'flu_tetanus'
      items.push({ id: `vaccine-${record.id}`, horse: horseNames.get(record.horse_id) || 'Horse', horseId: record.horse_id, kind: 'Vaccination', detail: vaccineType === 'rhino' ? 'Rhino' : 'Flu + tetanus', due: record.next_due_on, menu: 'Vaccinations', vaccineType, level: record.next_due_on < today ? 'overdue' : 'upcoming' })
    }
    for (const record of latestBy(deworming, (item) => item.horse_id)) {
      if (!record.next_due_on || record.next_due_on > horizon || !horseNames.has(record.horse_id)) continue
      items.push({ id: `deworm-${record.id}`, horse: horseNames.get(record.horse_id) || 'Horse', horseId: record.horse_id, kind: 'Deworming', detail: 'Next treatment', due: record.next_due_on, menu: 'Deworming', level: record.next_due_on < today ? 'overdue' : 'upcoming' })
    }
    for (const item of followUps) {
      if (!horseNames.has(item.horse_id) || (item.is_done && (!item.followup_on || item.followup_on > horizon))) continue
      const due = item.followup_on || today
      if (due > horizon) continue
      items.push({ id: `followup-${item.id}`, horse: horseNames.get(item.horse_id) || 'Horse', horseId: item.horse_id, kind: 'Vet follow-up', detail: item.complaint, due, menu: 'Visits', level: due < today ? 'overdue' : 'upcoming' })
    }
    for (const visit of appointments) {
      if (visit.visit_date > horizon) continue
      items.push({ id: `visit-${visit.id}`, horse: 'Scheduled visit', kind: 'Vet appointment', detail: visit.title || 'Appointment', due: visit.visit_date, menu: 'Visits', initialDate: visit.visit_date, level: visit.visit_date < today ? 'overdue' : 'upcoming' })
    }
    for (const alert of expiryAlerts) {
      if (!alert.expiry_date || alert.expiry_status === 'ok') continue
      items.push({ id: `expiry-${alert.id}`, horse: 'Medicine stock', kind: alert.expiry_status === 'expired' ? 'Expired batch' : 'Expiring batch', detail: alert.medicine_name, due: alert.expiry_date, menu: 'Medicines', level: alert.expiry_status === 'expired' ? 'overdue' : 'upcoming' })
    }
    return items.sort((a, b) => a.due.localeCompare(b.due))
  }, [horses, vaccinations, deworming, followUps, appointments, expiryAlerts])

  const overdueCount = queue.filter((item) => item.level === 'overdue').length
  const dueSoonCount = queue.filter((item) => item.level === 'upcoming' && item.kind !== 'Expiring batch').length
  const openFollowUps = followUps.filter((item) => !item.is_done || (item.followup_on && item.followup_on <= plusDaysISO(3))).length
  const stockAlertCount = expiryAlerts.length

  const open = (menu: VetMenu, horseId?: string, vaccineType: 'flu_tetanus' | 'rhino' = 'flu_tetanus', date?: string) => {
    setEntryHorseId(horseId || null)
    setEntryVaccineType(vaccineType)
    setEntryDate(date || null)
    setActiveMenu(menu)
  }

  if (activeMenu === 'Xray') return <XraysTab onBack={() => setActiveMenu(null)} />
  if (activeMenu === 'Lab Results') return <LabResultsTab onBack={() => setActiveMenu(null)} />
  if (activeMenu === 'Visits') return <VetVisitsTab initialHorseId={entryHorseId || undefined} initialDate={entryDate || undefined} onBack={() => setActiveMenu(null)} />
  if (activeMenu === 'Vaccinations') return <VaccinationsTab initialHorseId={entryHorseId || undefined} initialType={entryVaccineType} onBack={() => setActiveMenu(null)} />
  if (activeMenu === 'Deworming') return <DewormingTab initialHorseId={entryHorseId || undefined} onBack={() => setActiveMenu(null)} />
  if (activeMenu === 'Medicines') return <div className={styles.subpage}><button type="button" className={styles.backLink} onClick={() => setActiveMenu(null)}>← Care overview</button><MedicinesTab initialUsageHorseId={entryHorseId || undefined} /></div>
  if (activeMenu === 'Breeding') return <CareTab onBack={() => setActiveMenu(null)} />

  const actions: { menu: VetMenu; title: string; description: string; symbol: string; needsHorse: boolean }[] = [
    { menu: 'Visits', title: 'Log a vet concern', description: 'Choose a horse and add a concern or follow-up.', symbol: '+', needsHorse: true },
    { menu: 'Vaccinations', title: 'Record a vaccination', description: 'Choose a horse, vaccine and date.', symbol: '+', needsHorse: true },
    { menu: 'Deworming', title: 'Record deworming', description: 'Choose a horse, product and date.', symbol: '+', needsHorse: true },
    { menu: 'Medicines', title: 'Record medicine use', description: 'Choose a horse and record medicine from stock.', symbol: '+', needsHorse: true },
  ]

  function startQuickEntry(menu: VetMenu) {
    setQuickStartMenu(menu)
    setQuickStartHorseId('')
  }

  function continueQuickEntry() {
    if (!quickStartMenu || !quickStartHorseId) return
    open(quickStartMenu, quickStartHorseId)
    setQuickStartMenu(null)
    setQuickStartHorseId('')
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.dashboardHeader}>
        <div><span className={styles.kicker}>HEALTH & BREEDING</span><h1>Care overview</h1><p>See what needs attention and record care without searching through separate screens.</p></div>
        <button type="button" className={styles.refreshButton} onClick={() => { setLoadError(''); setLoading(true); void loadOverview() }} disabled={loading}>Refresh</button>
      </header>

      <section className={styles.summaryGrid} aria-label="Health summary">
        <article className={`${styles.summaryCard} ${overdueCount ? styles.summaryUrgent : ''}`}><span>Overdue</span><strong>{loading ? '—' : overdueCount}</strong><small>Items needing attention</small></article>
        <article className={styles.summaryCard}><span>Health items due in 30 days</span><strong>{loading ? '—' : dueSoonCount}</strong><small>Preventive care and appointments</small></article>
        <article className={styles.summaryCard}><span>Open follow-ups</span><strong>{loading ? '—' : openFollowUps}</strong><small>Veterinary care items</small></article>
        <article className={styles.summaryCard}><span>Medicine expiry alerts</span><strong>{loading ? '—' : stockAlertCount}</strong><small>Expired or expiring batches</small></article>
      </section>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>YOUR WORKLIST</span><h2>Upcoming and overdue</h2></div><button type="button" className={styles.textButton} onClick={() => open('Visits')}>Open care history →</button></div>
        {loadError ? <div className={styles.loadError} role="alert"><span>{loadError}</span><button type="button" onClick={() => void loadOverview()}>Try again</button></div> : loading ? <p className={styles.emptyState}>Loading care items…</p> : queue.length === 0 ? <div className={styles.emptyState}><strong>You’re up to date</strong><span>No overdue items or care due in the next 30 days.</span></div> : (
          <div className={styles.queueList}>{queue.slice(0, 10).map((item) => <button key={item.id} type="button" className={styles.queueItem} onClick={() => open(item.menu, item.horseId, item.vaccineType, item.initialDate)}><span className={`${styles.queueMarker} ${item.level === 'overdue' ? styles.markerUrgent : ''}`} /><span className={styles.queueHorse}>{item.horse}<small>{item.kind} · {item.detail}</small></span><span className={`${styles.queueDate} ${item.level === 'overdue' ? styles.dateUrgent : ''}`}>{item.level === 'overdue' ? 'Overdue' : 'Due'} · {formatShortDate(item.due)}</span><span className={styles.queueArrow}>→</span></button>)}</div>
        )}
      </section>

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>QUICK ENTRY</span><h2>What would you like to record?</h2></div></div>
        <div className={styles.actionGrid}>{actions.map((item) => <button key={item.menu} type="button" className={styles.actionCard} onClick={() => item.needsHorse ? startQuickEntry(item.menu) : open(item.menu)}><span className={styles.actionSymbol}>{item.symbol}</span><strong>{item.title}</strong><span>{item.description}</span></button>)}</div>
      </section>

      {quickStartMenu && <div className={styles.quickOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setQuickStartMenu(null) }}><section className={styles.quickDialog} role="dialog" aria-modal="true" aria-labelledby="quick-entry-title"><div className={styles.quickDialogHead}><div><span className={styles.kicker}>QUICK ENTRY</span><h2 id="quick-entry-title">Choose a horse</h2><p>This will open a new {quickStartMenu === 'Visits' ? 'vet concern' : quickStartMenu === 'Vaccinations' ? 'vaccination record' : quickStartMenu === 'Deworming' ? 'deworming record' : 'medicine usage'} for the selected horse.</p></div><button type="button" className={styles.quickClose} aria-label="Close" onClick={() => setQuickStartMenu(null)}>×</button></div><label className={styles.quickField}>Horse<select autoFocus required value={quickStartHorseId} onChange={(event) => setQuickStartHorseId(event.target.value)}><option value="">Select a horse</option>{horses.map((horse) => <option key={horse.id} value={horse.id}>{horse.name}</option>)}</select></label>{quickStartMenu === 'Vaccinations' && <label className={styles.quickField}>Vaccine<select value={entryVaccineType} onChange={(event) => setEntryVaccineType(event.target.value === 'rhino' ? 'rhino' : 'flu_tetanus')}><option value="flu_tetanus">Flu + tetanus</option><option value="rhino">Rhino</option></select></label>}<div className={styles.quickDialogActions}><button type="button" className={styles.quickCancel} onClick={() => setQuickStartMenu(null)}>Cancel</button><button type="button" className={styles.quickContinue} disabled={!quickStartHorseId} onClick={continueQuickEntry}>Continue to entry →</button></div></section></div>}

      <section className={styles.dashboardSection}>
        <div className={styles.sectionHead}><div><span className={styles.kicker}>RECORDS</span><h2>Browse health records</h2></div></div>
        <div className={styles.recordGrid}>
          <button type="button" onClick={() => open('Visits')}><strong>Vet visits & follow-ups</strong><span>Concerns, appointments, treatment and follow-up notes</span></button>
          <button type="button" onClick={() => open('Vaccinations')}><strong>Vaccinations</strong><span>Due dates, passport checks and dose history</span></button>
          <button type="button" onClick={() => open('Deworming')}><strong>Deworming</strong><span>Schedules, treatments and history</span></button>
          <button type="button" onClick={() => open('Medicines')}><strong>Medicines & stock</strong><span>Products, batches, expiry dates and usage</span></button>
          <button type="button" onClick={() => open('Xray')}><strong>X-rays</strong><span>Imaging and surgery follow-up</span></button>
          <button type="button" onClick={() => open('Lab Results')}><strong>Lab results</strong><span>Blood tests and diagnostic reports</span></button>
          <button type="button" onClick={() => open('Breeding')}><strong>Breeding & foaling</strong><span>Scans, insemination, pregnancy and birth records</span></button>
        </div>
      </section>
    </main>
  )
}
