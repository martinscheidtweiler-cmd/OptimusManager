'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import { useLocale } from '@/app/components/LanguageProvider'
import { staffLocationPresentation, staffTaskPresentation } from '@/app/lib/staffTaskLabels'
import { brusselsDayRange, entryOverlapMs, entrySegment, nextBrusselsDay } from '@/app/lib/staffAnalytics'
import StaffMap from './StaffMap'
import './staff-dashboard.css'

type Item = { id: number; name: string; active: boolean; location_id?: number; phone?: string }
type Shift = { id: string; worker_id: number; device_id: string | null; paired_device_id: string | null; started_at: string; ended_at: string | null }
type Entry = { id: string; shift_id: string; task_id: number; started_at: string; ended_at: string | null }
type Position = { shift_id: string; lat: number; lon: number; accuracy: number; updated_at: string }
type Device = { id: string; label: string; active: boolean; created_at: string; last_seen_at: string | null }

const COLORS = ['#436e58', '#d6a64e', '#607d9d', '#9675a7', '#a98465', '#9ca3af']
const fmt = (ms: number) => {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(minutes / 60)}u ${String(minutes % 60).padStart(2, '0')}m`
}
const day = (date: Date) => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date)
const clock = (value: string) => new Date(value).toLocaleTimeString('nl-BE', {
  timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit',
})
const ago = (value: string | null, now: number) => {
  if (!value) return 'Nog niet verbonden'
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  return minutes < 1 ? 'Zojuist' : `${minutes} min geleden`
}

export default function StaffDashboard() {
  const locale = useLocale()
  const [workers, setWorkers] = useState<Item[]>([])
  const [locations, setLocations] = useState<Item[]>([])
  const [tasks, setTasks] = useState<Item[]>([])
  const [contacts, setContacts] = useState<Item[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [error, setError] = useState('')
  const [now, setNow] = useState(0)
  const [date, setDate] = useState(day(new Date()))
  const [tab, setTab] = useState('Overzicht')
  const [kind, setKind] = useState('staff_workers')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState<number>(0)
  const [pairCode, setPairCode] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [pairBusy, setPairBusy] = useState(false)
  const [edit, setEdit] = useState<Item | null>(null)
  const [renamingDevice, setRenamingDevice] = useState('')
  const [renamedLabel, setRenamedLabel] = useState('')

  const load = useCallback(async () => {
    const weekStartDate = new Date(`${date}T12:00:00Z`)
    weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 6)
    const from = brusselsDayRange(day(weekStartDate)).start
    const to = brusselsDayRange(nextBrusselsDay(date)).start
    const fromIso = new Date(from).toISOString()
    const toIso = new Date(to).toISOString()
    const [w, l, t, c, d, s, e, p] = await Promise.all([
      supabase.from('staff_workers').select('*').order('name'),
      supabase.from('staff_locations').select('*').order('id'),
      supabase.from('staff_tasks').select('*').order('id'),
      supabase.from('staff_contacts').select('*').order('name'),
      supabase.rpc('staff_pair_admin', { operation: 'list' }),
      supabase.from('staff_shifts').select('*').lt('started_at', toIso)
        .or(`ended_at.is.null,ended_at.gt.${fromIso}`).order('started_at', { ascending: false }).limit(5000),
      supabase.from('staff_entries').select('*').lt('started_at', toIso)
        .or(`ended_at.is.null,ended_at.gt.${fromIso}`).order('started_at', { ascending: false }).limit(20000),
      supabase.from('staff_positions').select('*'),
    ])
    const failed = [w, l, t, c, d, s, e, p].find(result => result.error)
    if (failed?.error) setError(failed.error.message)
    else setError('')
    setWorkers(w.data || [])
    setLocations(l.data || [])
    setTasks(t.data || [])
    setContacts(c.data || [])
    setDevices((d.data || []) as Device[])
    setShifts(s.data || [])
    setEntries(e.data || [])
    setPositions(p.data || [])
    setNow(Date.now())
  }, [date])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0)
    const refresh = window.setInterval(() => void load(), 15000)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); window.clearInterval(tick) }
  }, [load])

  const taskLabel = (id: number) => {
    const task = tasks.find(item => item.id === id)
    if (!task) return 'Onbekend'
    const shownTask = staffTaskPresentation(task.name, locale)
    const place = locations.find(item => item.id === task.location_id)
    const shownPlace = place ? staffLocationPresentation(place.name, locale) : null
    return `${shownTask.icon} ${shownTask.label} · ${shownPlace ? `${shownPlace.icon} ${shownPlace.label}` : ''}`
  }
  const device = (id: string | null) => devices.find(item => item.id === id)
  const workerName = (id: number) => workers.find(item => item.id === id)?.name || 'Onbekend'
  const live = shifts.filter(shift => !shift.ended_at)
  const onlineDevices = devices.filter(item => item.active && item.last_seen_at && now - Date.parse(item.last_seen_at) < 120000).length
  const selectedDuration = (entry: Entry) => entryOverlapMs(entry, date, now)
  const daily = entries.filter(entry => selectedDuration(entry) > 0)
  const total = daily.reduce((sum, entry) => sum + selectedDuration(entry), 0)
  const range = brusselsDayRange(date)
  const completed = daily.filter(entry => entry.ended_at && Date.parse(entry.ended_at) >= range.start && Date.parse(entry.ended_at) < range.end)
  const groups = tasks.map(task => {
    const taskEntries = daily.filter(entry => entry.task_id === task.id)
    const duration = taskEntries.reduce((sum, entry) => sum + selectedDuration(entry), 0)
    return { id: task.id, label: taskLabel(task.id), duration, count: taskEntries.length, average: taskEntries.length ? duration / taskEntries.length : 0 }
  }).filter(group => group.duration > 0).sort((a, b) => b.duration - a.duration)
  const week = Array.from({ length: 7 }, (_, index) => {
    const current = new Date(`${date}T12:00:00Z`)
    current.setUTCDate(current.getUTCDate() - 6 + index)
    const label = day(current)
    return { label, duration: entries.reduce((sum, entry) => sum + entryOverlapMs(entry, label, now), 0) }
  })
  const maxWeek = Math.max(1, ...week.map(item => item.duration))
  const durationByWorker = workers.map(worker => ({
    id: worker.id,
    name: worker.name,
    duration: daily.filter(entry => shifts.find(shift => shift.id === entry.shift_id)?.worker_id === worker.id)
      .reduce((sum, entry) => sum + selectedDuration(entry), 0),
  })).filter(item => item.duration > 0).sort((a, b) => b.duration - a.duration)
  const durationByLocation = locations.map(place => {
    const taskIds = new Set(tasks.filter(task => task.location_id === place.id).map(task => task.id))
    const duration = daily.filter(entry => taskIds.has(entry.task_id)).reduce((sum, entry) => sum + selectedDuration(entry), 0)
    return { id: place.id, name: place.name, duration }
  }).filter(item => item.duration > 0).sort((a, b) => b.duration - a.duration)

  async function saveItem() {
    if (!name.trim()) return
    const payload = {
      name: name.trim(), active: edit?.active ?? true,
      ...(kind === 'staff_tasks' ? { location_id: location || locations[0]?.id } : {}),
      ...(kind === 'staff_contacts' ? { phone: phone.trim() || null } : {}),
    }
    const result = edit
      ? await supabase.from(kind).update(payload).eq('id', edit.id)
      : await supabase.from(kind).insert(payload)
    if (result.error) setError(result.error.message)
    else { setName(''); setPhone(''); setEdit(null); await load() }
  }

  const list = kind === 'staff_workers' ? workers : kind === 'staff_locations' ? locations : kind === 'staff_tasks' ? tasks : contacts
  async function toggleItem(item: Item) {
    const result = await supabase.from(kind).update({ active: !item.active }).eq('id', item.id)
    if (result.error) setError(result.error.message)
    else await load()
  }

  async function registerDevice() {
    if (pairBusy || !deviceName.trim()) return
    setPairBusy(true)
    setError('')
    try {
      const result = await supabase.rpc('staff_pair_admin', { operation: 'create', device_label: deviceName.trim() })
      if (result.error) setError(result.error.message)
      else { setPairCode(result.data.code); setDeviceName(''); await load() }
    } finally { setPairBusy(false) }
  }

  async function renameDevice(id: string) {
    if (!renamedLabel.trim()) return
    const result = await supabase.rpc('staff_pair_admin', { operation: 'rename', device: id, device_label: renamedLabel.trim() })
    if (result.error) setError(result.error.message)
    else { setRenamingDevice(''); setRenamedLabel(''); await load() }
  }

  async function revokeDevice(id: string) {
    if (!window.confirm('Toegang intrekken en de actieve werkdag voor dit toestel afsluiten?')) return
    const result = await supabase.rpc('staff_pair_admin', { operation: 'revoke', device: id })
    if (result.error) setError(result.error.message)
    else await load()
  }

  const deviceStatus = (item: Device) => item.active && item.last_seen_at && now - Date.parse(item.last_seen_at) < 120000

  return <section className="staff-dashboard">
    <header className="sd-head">
      <div><h1>Personeel</h1><p>Werkoverzicht · synchronisatie iedere 15 seconden</p></div>
      <a href="/staff" target="_blank" rel="noreferrer">Telefoonapp openen ↗</a>
    </header>
    {error && <p role="alert" className="sd-error">{error}</p>}
    <nav>{['Overzicht', 'Taakanalyse', 'Beheer'].map(item => <button key={item} className={tab === item ? 'selected' : ''} onClick={() => { setTab(item); setName(''); setEdit(null) }}>{item}</button>)}</nav>

    {tab === 'Beheer' ? <>
      <div className="sd-card">
        <h2>Medewerkers, locaties, taken en contacten</h2>
        <select value={kind} onChange={event => { setKind(event.target.value); setEdit(null); setName(''); setPhone('') }}>
          <option value="staff_workers">Medewerkers</option><option value="staff_locations">Locaties</option>
          <option value="staff_tasks">Taken</option><option value="staff_contacts">Contactpersonen</option>
        </select>
        <div className="sd-form">
          <input placeholder="Naam" value={name} onChange={event => setName(event.target.value)} />
          {kind === 'staff_tasks' && <select value={location || locations[0]?.id || 0} onChange={event => setLocation(Number(event.target.value))}>{locations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
          {kind === 'staff_contacts' && <input placeholder="Telefoonnummer" value={phone} onChange={event => setPhone(event.target.value)} />}
          <button onClick={saveItem}>{edit ? 'Opslaan' : 'Toevoegen'}</button>
        </div>
        <table><tbody>{list.map(item => <tr key={item.id}>
          <td>{kind === 'staff_tasks'
            ? (() => { const shownTask = staffTaskPresentation(item.name, locale); const place = locations.find(value => value.id === item.location_id); const shownPlace = place ? staffLocationPresentation(place.name, locale) : null; return `${shownTask.icon} ${shownTask.label} · ${shownPlace ? `${shownPlace.icon} ${shownPlace.label}` : ''}` })()
            : kind === 'staff_locations'
              ? (() => { const shownPlace = staffLocationPresentation(item.name, locale); return `${shownPlace.icon} ${shownPlace.label}` })()
              : item.name} {item.phone}</td>
          <td>{item.active ? 'Actief' : 'Inactief'}</td>
          <td><button onClick={() => { setEdit(item); setName(item.name); setPhone(item.phone || ''); setLocation(item.location_id || 0) }}>Bewerken</button>{' '}
            <button onClick={() => void toggleItem(item)}>{item.active ? 'Deactiveren' : 'Activeren'}</button></td>
        </tr>)}</tbody></table>
      </div>

      <div className="sd-card">
        <h2>Werktelefoons</h2>
        <p>Maak per bedrijfstelefoon een unieke code. De code is eenmalig zichtbaar en blijft niet als leesbare tekst in de database bewaard.</p>
        <div className="sd-form"><input placeholder="Toestelnaam (bijv. TEST)" value={deviceName} onChange={event => setDeviceName(event.target.value)} />
          <button disabled={pairBusy || !deviceName.trim()} onClick={() => void registerDevice()}>{pairBusy ? 'Even wachten…' : 'Koppelcode maken'}</button></div>
        {pairCode && <div className="sd-card"><strong>Nieuwe koppelcode — alleen nu zichtbaar</strong>
          <p style={{ overflowWrap: 'anywhere', fontFamily: 'monospace' }}>{pairCode}</p>
          <button onClick={async () => { try { await navigator.clipboard.writeText(pairCode) } catch { setError('Kopiëren mislukt. Selecteer de code handmatig.') } }}>Kopieer code</button>{' '}
          <button onClick={() => setPairCode('')}>Sluiten</button><p>Voer de code rechtstreeks in Optimus Tasks op de bedrijfstelefoon in.</p>
        </div>}
        {devices.map(item => <div key={item.id} className="sd-device-row">
          <div><strong>{item.label}</strong><small>{item.active ? (deviceStatus(item) ? 'Online' : 'Offline') : 'Geblokkeerd'} · laatste verbinding: {ago(item.last_seen_at, now)}</small></div>
          {renamingDevice === item.id ? <div className="sd-form"><input aria-label="Nieuwe toestelnaam" value={renamedLabel} onChange={event => setRenamedLabel(event.target.value)} />
            <button onClick={() => void renameDevice(item.id)}>Opslaan</button><button onClick={() => setRenamingDevice('')}>Annuleren</button></div> : <>
            <button disabled={!item.active} onClick={() => { setRenamingDevice(item.id); setRenamedLabel(item.label) }}>Naam wijzigen</button>{' '}
            {item.active && <button onClick={() => void revokeDevice(item.id)}>Blokkeren</button>}
          </>}
        </div>)}
      </div>
    </> : <>
      <div className="sd-date"><label>Datum <input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button onClick={() => setDate(day(new Date()))}>Vandaag</button></div>
      <div className="sd-kpis">
        <div><small>ACTIEVE MEDEWERKERS</small><strong>{live.length}</strong></div>
        <div><small>WERKTELEFOONS ONLINE</small><strong>{onlineDevices} / {devices.filter(item => item.active).length}</strong></div>
        <div><small>GEREGISTREERDE TIJD</small><strong>{fmt(total)}</strong></div>
        <div><small>AFGERONDE TAKEN</small><strong>{completed.length}</strong></div>
      </div>

      {tab === 'Overzicht' && <>
        <div className="sd-grid">
          <div className="sd-card"><h2>Medewerkers · nu actief</h2>
            <table><thead><tr><th>Toestel</th><th>Medewerker</th><th>Taak</th><th>Duur</th></tr></thead><tbody>
              {live.map(shift => {
                const entry = entries.find(item => item.shift_id === shift.id && !item.ended_at)
                const linked = device(shift.paired_device_id)
                return <tr key={shift.id}><td>{linked?.label || 'Oud toestel'}<br /><small>{linked ? (deviceStatus(linked) ? 'Online' : 'Offline') : 'Legacy'}</small></td><td>{workerName(shift.worker_id)}</td><td>{entry ? taskLabel(entry.task_id) : 'Geen taak'}</td><td>{entry ? fmt(Math.max(0, now - Date.parse(entry.started_at))) : '—'}</td></tr>
              })}
            </tbody></table>{!live.length && <p>Geen actieve werkdag.</p>}
            <small>Laatst gesynchroniseerd met het dashboard: {new Date(now).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
          </div>
          <div className="sd-card"><h2>GPS · actieve toestellen</h2>
            <StaffMap points={positions.filter(position => live.some(shift => shift.id === position.shift_id) && now - Date.parse(position.updated_at) < 120000).map(position => {
              const shift = live.find(item => item.id === position.shift_id)
              const linked = device(shift?.paired_device_id || null)
              return { id: position.shift_id, name: `${linked?.label || 'Toestel'} · ${workerName(shift?.worker_id || 0)}`, lat: position.lat, lon: position.lon, accuracy: position.accuracy }
            })} />
            {live.map(shift => {
              const position = positions.find(item => item.shift_id === shift.id)
              const linked = device(shift.paired_device_id)
              const fresh = position && now - Date.parse(position.updated_at) < 120000
              return <p key={shift.id}><strong>{linked?.label || 'Oud toestel'}</strong> · {workerName(shift.worker_id)} · {fresh && position
                ? <><span>GPS bijgewerkt {ago(position.updated_at, now)} · ±{Math.round(position.accuracy || 0)} m</span>{' · '}<a href={`https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lon}#map=17/${position.lat}/${position.lon}`} target="_blank" rel="noreferrer">Kaart ↗</a></>
                : 'Geen recente GPS-positie'}</p>
            })}
            <small>Alleen de huidige positie tijdens een actieve werkdag wordt bewaard; er is geen routehistoriek.</small>
          </div>
        </div>
        <div className="sd-card"><h2>Dagoverzicht per medewerker · 00:00–24:00</h2>
          <div className="sd-timeline"><div className="sd-axis"><span /><div>{[0, 4, 8, 12, 16, 20, 24].map(hour => <small key={hour}>{String(hour).padStart(2, '0')}:00</small>)}</div></div>
            {workers.map(worker => <div className="sd-row" key={worker.id}><b>{worker.name}</b><div className="sd-track">
              {daily.filter(entry => shifts.find(shift => shift.id === entry.shift_id)?.worker_id === worker.id).map(entry => {
                const segment = entrySegment(entry, date, now)
                return segment ? <span key={entry.id} title={`${taskLabel(entry.task_id)} · ${fmt(selectedDuration(entry))}`} style={{ left: `${segment.left}%`, width: `${segment.width}%`, background: COLORS[(entry.task_id - 1) % COLORS.length] }} /> : null
              })}
            </div></div>)}
          </div>
          <table><thead><tr><th>Medewerker</th><th>Toestel</th><th>Taak</th><th>Start</th><th>Tijd op gekozen dag</th></tr></thead><tbody>
            {daily.map(entry => { const shift = shifts.find(item => item.id === entry.shift_id); return <tr key={entry.id}><td>{shift ? workerName(shift.worker_id) : 'Onbekend'}</td><td>{device(shift?.paired_device_id || null)?.label || (shift?.device_id ? 'Oud toestel' : '—')}</td><td>{taskLabel(entry.task_id)}</td><td>{clock(entry.started_at)}</td><td>{fmt(selectedDuration(entry))}</td></tr> })}
          </tbody></table>
        </div>
      </>}

      <div className="sd-grid">
        <div className="sd-card"><h2>Taakduur · {date}</h2><table><thead><tr><th>Taak · locatie</th><th>Tijd op deze dag</th><th>Gemiddeld</th><th>Aantal</th></tr></thead><tbody>
          {groups.map(group => <tr key={group.id}><td>{group.label}</td><td>{fmt(group.duration)}</td><td>{fmt(group.average)}</td><td>{group.count}</td></tr>)}
        </tbody></table>{!groups.length && <p>Nog geen gegevens.</p>}</div>
        <div className="sd-card"><h2>Geregistreerde tijd per dag</h2><div className="sd-bars">{week.map(item => <div key={item.label}><small>{fmt(item.duration)}</small><span style={{ height: Math.max(1, item.duration / maxWeek * 130) }} /><small>{item.label.slice(5)}</small></div>)}</div></div>
      </div>
      {tab === 'Taakanalyse' && <div className="sd-grid">
        <div className="sd-card"><h2>Tijd per medewerker · {date}</h2><table><thead><tr><th>Medewerker</th><th>Tijd</th></tr></thead><tbody>{durationByWorker.map(item => <tr key={item.id}><td>{item.name}</td><td>{fmt(item.duration)}</td></tr>)}</tbody></table></div>
        <div className="sd-card"><h2>Tijd per locatie · {date}</h2><table><thead><tr><th>Locatie</th><th>Tijd</th></tr></thead><tbody>{durationByLocation.map(item => <tr key={item.id}><td>{item.name}</td><td>{fmt(item.duration)}</td></tr>)}</tbody></table></div>
      </div>}
      <small>Dagtotalen verdelen taken over middernacht over de betrokken kalenderdagen. Tijden worden als echte verstreken minuten berekend, ook bij zomer- en wintertijd.</small>
    </>}
  </section>
}
