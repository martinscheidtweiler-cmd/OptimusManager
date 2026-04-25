'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import styles from './XraysTab.module.css'

const XRAY_PASSWORD = 'Vero6565'

type XrayType = 'general' | '2yo' | '6yo'

type Horse = {
  id: string
  name: string
  active: boolean | null
  horse_type: string | null
  birth_date: string | null
}

type XrayRecord = {
  id: string
  horse_id: string
  xray_type: XrayType | null
  xray_url: string | null
  report_url: string | null
  note: string | null
  taken_on: string | null
  recheck_on: string | null
  created_at: string
  needs_surgery: boolean | null
  surgery_done: boolean | null
}

type Props = {
  onBack: () => void
}

export default function XraysTab({ onBack }: Props) {
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState('')

  const [horses, setHorses] = useState<Horse[]>([])
  const [records, setRecords] = useState<XrayRecord[]>([])
  const [selectedHorseId, setSelectedHorseId] = useState('')
  const [search, setSearch] = useState('')

  const [takenOn, setTakenOn] = useState('')
  const [recheckOn, setRecheckOn] = useState('')
  const [xrayType, setXrayType] = useState<XrayType>('general')
  const [note, setNote] = useState('')
  const [needsSurgery, setNeedsSurgery] = useState(false)
  const [xrayFile, setXrayFile] = useState<File | null>(null)
  const [reportFile, setReportFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)

    try {
      const [{ data: horsesData, error: horsesError }, { data: recordsData, error: recordsError }] =
        await Promise.all([
          supabase
            .from('horses')
            .select('id, name, active, horse_type, birth_date')
            .eq('active', true)
            .in('horse_type', ['Sport horse', 'Young horse', 'Foal'])
            .order('name', { ascending: true }),

          supabase
            .from('horse_xray_records')
            .select(
              'id, horse_id, xray_type, xray_url, report_url, note, taken_on, recheck_on, created_at, needs_surgery, surgery_done'
            )
            .order('created_at', { ascending: false }),
        ])

      if (horsesError) throw horsesError
      if (recordsError) throw recordsError

      setHorses((horsesData || []) as Horse[])
      setRecords((recordsData || []) as XrayRecord[])
    } catch (err) {
      console.error('Error loading xray data:', err)
      setHorses([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (unlocked) loadData()
  }, [unlocked])

  const filteredHorses = useMemo(() => {
    return horses.filter((horse) =>
      (horse.name || '').toLowerCase().includes(search.toLowerCase())
    )
  }, [horses, search])

  const selectedHorse = useMemo(() => {
    return horses.find((horse) => horse.id === selectedHorseId) || null
  }, [horses, selectedHorseId])

  const selectedRecords = useMemo(() => {
    if (!selectedHorseId) return []
    return records.filter((record) => record.horse_id === selectedHorseId)
  }, [records, selectedHorseId])

  const getAge = (horse: Horse) => {
    if (!horse.birth_date) return null

    const today = new Date()
    const birth = new Date(horse.birth_date)

    if (Number.isNaN(birth.getTime())) return null

    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }

    return age
  }

  const getAgeXrayAlert = (horse: Horse) => {
    const age = getAge(horse)
    if (age === null) return null

    const horseRecords = records.filter((record) => record.horse_id === horse.id)

    const has2yo = horseRecords.some((record) => record.xray_type === '2yo')
    const has6yo = horseRecords.some((record) => record.xray_type === '6yo')

    if (age >= 6 && !has6yo) return '6yo'
    if (age >= 2 && !has2yo) return '2yo'

    return null
  }

  const horseNeedsSurgery = (horseId: string) => {
    return records.some(
      (record) =>
        record.horse_id === horseId &&
        record.needs_surgery === true &&
        record.surgery_done !== true
    )
  }

  const horseNeedsRecheck = (horseId: string) => {
    return records.some((record) => {
      if (record.horse_id !== horseId || !record.recheck_on) return false

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const recheck = new Date(record.recheck_on)
      recheck.setHours(0, 0, 0, 0)

      return recheck <= today
    })
  }

  const uploadFile = async (file: File, horseId: string, type: 'xray' | 'report') => {
    const ext = file.name.split('.').pop() || 'file'
    const cleanName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .toLowerCase()

    const path = `${horseId}/${type}-${Date.now()}-${cleanName}.${ext}`

    const { error } = await supabase.storage.from('horse-xrays').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw error

    const { data } = supabase.storage.from('horse-xrays').getPublicUrl(path)
    return data.publicUrl
  }

  const saveRecord = async () => {
    if (!selectedHorseId) {
      alert('Selecteer eerst een paard.')
      return
    }

    if (!xrayFile && !reportFile && !note.trim() && !needsSurgery && !recheckOn) {
      alert('Upload een xray, rapport, vink surgery aan, stel recheck in of schrijf een opmerking.')
      return
    }

    setSaving(true)

    try {
      let xrayUrl: string | null = null
      let reportUrl: string | null = null

      if (xrayFile) xrayUrl = await uploadFile(xrayFile, selectedHorseId, 'xray')
      if (reportFile) reportUrl = await uploadFile(reportFile, selectedHorseId, 'report')

      const { error } = await supabase.from('horse_xray_records').insert({
        horse_id: selectedHorseId,
        xray_type: xrayType,
        xray_url: xrayUrl,
        report_url: reportUrl,
        note: note.trim() || null,
        taken_on: takenOn || null,
        recheck_on: recheckOn || null,
        needs_surgery: needsSurgery,
        surgery_done: false,
      })

      if (error) throw error

      setXrayFile(null)
      setReportFile(null)
      setNote('')
      setTakenOn('')
      setRecheckOn('')
      setXrayType('general')
      setNeedsSurgery(false)

      const xrayInput = document.getElementById('xray-file') as HTMLInputElement | null
      const reportInput = document.getElementById('report-file') as HTMLInputElement | null

      if (xrayInput) xrayInput.value = ''
      if (reportInput) reportInput.value = ''

      await loadData()
    } catch (err) {
      console.error('Error saving xray record:', err)
      alert('Opslaan mislukt.')
    } finally {
      setSaving(false)
    }
  }

  const toggleSurgeryDone = async (record: XrayRecord) => {
    const { error } = await supabase
      .from('horse_xray_records')
      .update({ surgery_done: !record.surgery_done })
      .eq('id', record.id)

    if (error) {
      console.error('Error updating surgery:', error)
      alert('Aanpassen mislukt.')
      return
    }

    await loadData()
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('Deze xray record verwijderen?')) return

    const { error } = await supabase.from('horse_xray_records').delete().eq('id', id)

    if (error) {
      console.error('Error deleting xray record:', error)
      alert('Verwijderen mislukt.')
      return
    }

    await loadData()
  }

  const formatDate = (value: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('nl-BE')
  }

  const formatXrayType = (type: XrayType | null) => {
    if (type === '2yo') return '2Y X-ray'
    if (type === '6yo') return '6Y X-ray'
    return 'General X-ray'
  }

  if (!unlocked) {
    return (
      <div className={styles.lockPage}>
        <div className={styles.lockCard}>
          <span className={styles.xrayKicker}>Protected area</span>
          <h2>X-rays & Reports</h2>
          <p>Enter the password to access medical imaging records.</p>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (password === XRAY_PASSWORD) setUnlocked(true)
                else alert('Wrong password.')
              }
            }}
          />

          <div className={styles.lockActions}>
            <button type="button" className={styles.xrayBack} onClick={onBack}>
              ← Back
            </button>

            <button
              type="button"
              className={styles.xraySave}
              onClick={() => {
                if (password === XRAY_PASSWORD) setUnlocked(true)
                else alert('Wrong password.')
              }}
            >
              Enter
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.xrayPage}>
      <div className={styles.xrayTopbar}>
        <button type="button" className={styles.xrayBack} onClick={onBack}>
          ← Back
        </button>

        <div>
          <span className={styles.xrayKicker}>Diagnostics</span>
          <h2>X-rays & Reports</h2>
          <p>Only active sport horses, young horses and foals.</p>
        </div>
      </div>

      <div className={styles.xrayLayout}>
        <aside className={styles.xraySidebar}>
          <input
            className={styles.xraySearch}
            placeholder="Search horse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className={styles.xrayHorseList}>
            {loading && <div className={styles.xrayEmpty}>Loading horses...</div>}

            {!loading &&
              filteredHorses.map((horse) => {
                const count = records.filter((r) => r.horse_id === horse.id).length
                const surgeryAlert = horseNeedsSurgery(horse.id)
                const recheckAlert = horseNeedsRecheck(horse.id)
                const ageAlert = getAgeXrayAlert(horse)

                return (
                  <button
                    key={horse.id}
                    type="button"
                    className={`${styles.xrayHorse} ${
                      selectedHorseId === horse.id ? styles.xrayHorseActive : ''
                    }`}
                    onClick={() => setSelectedHorseId(horse.id)}
                  >
                    <span>
                      {horse.name}

                      {ageAlert === '2yo' && <b className={styles.ageBadge}>2Y due</b>}
                      {ageAlert === '6yo' && <b className={styles.ageBadgeDanger}>6Y due</b>}
                      {surgeryAlert && <b className={styles.surgeryBadge}>Surgery</b>}
                      {recheckAlert && <b className={styles.recheckBadge}>Recheck</b>}
                    </span>

                    <small>
                      {horse.horse_type}
                      {horse.birth_date ? ` · ${getAge(horse)}y` : ''}
                      {' · '}
                      {count}
                    </small>
                  </button>
                )
              })}

            {!loading && filteredHorses.length === 0 && (
              <div className={styles.xrayEmpty}>No horses found.</div>
            )}
          </div>
        </aside>

        <main className={styles.xrayMain}>
          {!selectedHorse ? (
            <div className={styles.xrayPlaceholder}>
              <span>Select a horse</span>
              <strong>Choose a horse to manage x-rays and reports.</strong>
            </div>
          ) : (
            <>
              <section className={styles.xrayCard}>
                <div className={styles.xrayCardHead}>
                  <div>
                    <span className={styles.xrayKicker}>History</span>
                    <h3>Saved x-rays</h3>
                  </div>

                  <strong>{selectedRecords.length}</strong>
                </div>

                <div className={styles.xrayRecordList}>
                  {selectedRecords.length === 0 && (
                    <div className={styles.xrayEmpty}>No x-rays saved yet.</div>
                  )}

                  {selectedRecords.map((record) => (
                    <article key={record.id} className={styles.xrayRecord}>
                      <div className={styles.xrayRecordTop}>
                        <div>
                          <strong>{formatDate(record.taken_on)}</strong>
                          <span>{formatXrayType(record.xray_type)}</span>
                          <span>Added {formatDate(record.created_at)}</span>

                          {record.recheck_on && (
                            <span className={styles.recheckDate}>
                              Recheck: {formatDate(record.recheck_on)}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={styles.xrayDelete}
                          onClick={() => deleteRecord(record.id)}
                        >
                          Delete
                        </button>
                      </div>

                      {record.needs_surgery && (
                        <div
                          className={
                            record.surgery_done ? styles.surgeryDone : styles.surgeryNeeded
                          }
                        >
                          <span>{record.surgery_done ? 'Surgery done' : 'Needs surgery'}</span>

                          <button type="button" onClick={() => toggleSurgeryDone(record)}>
                            {record.surgery_done ? 'Mark not done' : 'Mark as done'}
                          </button>
                        </div>
                      )}

                      {record.note && <p className={styles.xrayNote}>{record.note}</p>}

                      <div className={styles.xrayLinks}>
                        {record.xray_url && (
                          <a href={record.xray_url} target="_blank" rel="noreferrer">
                            Open x-ray
                          </a>
                        )}

                        {record.report_url && (
                          <a href={record.report_url} target="_blank" rel="noreferrer">
                            Open report
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={`${styles.xrayCard} ${styles.xrayFormCard}`}>
                <div className={styles.xrayCardHead}>
                  <div>
                    <span className={styles.xrayKicker}>Add new record</span>
                    <h3>{selectedHorse.name}</h3>
                  </div>
                </div>

                <div className={styles.xrayFormGrid}>
                  <label>
                    X-ray type
                    <select
                      value={xrayType}
                      onChange={(e) => setXrayType(e.target.value as XrayType)}
                    >
                      <option value="general">General X-ray</option>
                      <option value="2yo">2Y X-ray</option>
                      <option value="6yo">6Y X-ray</option>
                    </select>
                  </label>

                  <label>
                    X-ray date
                    <input
                      type="date"
                      value={takenOn}
                      onChange={(e) => setTakenOn(e.target.value)}
                    />
                  </label>

                  <label>
                    Recheck date
                    <input
                      type="date"
                      value={recheckOn}
                      onChange={(e) => setRecheckOn(e.target.value)}
                    />
                  </label>

                  <label className={styles.fileUploadBox}>
                    <span>X-ray file</span>
                    <strong>{xrayFile ? xrayFile.name : 'Choose x-ray file'}</strong>
                    <small>Image or PDF</small>
                    <input
                      id="xray-file"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setXrayFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  <label className={styles.fileUploadBox}>
                    <span>Report</span>
                    <strong>{reportFile ? reportFile.name : 'Choose report file'}</strong>
                    <small>PDF or image</small>
                    <input
                      id="report-file"
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                    />
                  </label>

                  <label className={styles.surgeryCheck}>
                    <input
                      type="checkbox"
                      checked={needsSurgery}
                      onChange={(e) => setNeedsSurgery(e.target.checked)}
                    />

                    <span>
                      <strong>Needs surgery</strong>
                      <small>Shows a warning next to this horse until marked as done.</small>
                    </span>
                  </label>

                  <label className={styles.xrayFull}>
                    Remark
                    <textarea
                      placeholder="Example: needs surgery, re-check in 6 weeks..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className={styles.xraySave}
                  onClick={saveRecord}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save record'}
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}