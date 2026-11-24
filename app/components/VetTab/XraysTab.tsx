'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLocale } from '../LanguageProvider'
import styles from './XraysTab.module.css'

type XrayType = 'general' | '2yo' | '6yo'

type Horse = {
  id: string
  name: string
  horse_number: string | null
  registered_name: string | null
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

function todayISO() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message?: unknown }).message)
  }
  return String(err)
}

export default function XraysTab({ onBack }: Props) {
  useLocale()

  const [horses, setHorses] = useState<Horse[]>([])
  const [records, setRecords] = useState<XrayRecord[]>([])
  const [selectedHorseId, setSelectedHorseId] = useState('')
  const [search, setSearch] = useState('')

  const [takenOn, setTakenOn] = useState(todayISO())
  const [recheckOn, setRecheckOn] = useState('')
  const [xrayType, setXrayType] = useState<XrayType>('general')
  const [note, setNote] = useState('')
  const [needsSurgery, setNeedsSurgery] = useState(false)

  const [xrayFile, setXrayFile] = useState<File | null>(null)
  const [reportFile, setReportFile] = useState<File | null>(null)

  const [xrayLink, setXrayLink] = useState('')
  const [reportLink, setReportLink] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)

    try {
      const [{ data: horsesData, error: horsesError }, { data: recordsData, error: recordsError }] =
        await Promise.all([
          supabase
            .from('horses')
            .select('id, name, horse_number, registered_name, active, horse_type, birth_date')
            .eq('active', true)
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
      console.error('XRAY LOAD ERROR:', err)
      alert(`Could not load records: ${errorMessage(err)}`)
      setHorses([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const getHorseDisplayName = (horse: Horse) => horse.registered_name?.trim() || horse.name || 'Unnamed horse'

  const filteredHorses = useMemo(() => {
    const query = search.trim().toLowerCase()
    return horses
      .filter((horse) => [horse.registered_name, horse.name, horse.horse_number].some((value) => (value || '').toLowerCase().includes(query)))
      .filter((horse) => query || records.some((record) => record.horse_id === horse.id))
      .sort((a, b) => {
        const priority = (horse: Horse) => records.some((record) => record.horse_id === horse.id && record.needs_surgery && !record.surgery_done) ? 3 : records.some((record) => record.horse_id === horse.id) ? 2 : 0
        return priority(b) - priority(a) || getHorseDisplayName(a).localeCompare(getHorseDisplayName(b))
      })
  }, [horses, records, search])

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
    const ext = file.name.split('.').pop()?.toLowerCase() || 'file'
    const cleanName =
      file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase() || 'file'

    const path = `${horseId}/${type}-${Date.now()}-${cleanName}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('horse-xrays')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })

    if (uploadError) {
      console.error('XRAY UPLOAD ERROR:', uploadError)
      throw new Error(`Could not upload ${type}: ${uploadError.message}`)
    }

    const { data } = supabase.storage.from('horse-xrays').getPublicUrl(path)

    if (!data.publicUrl) {
      throw new Error(`No public URL was returned for ${type}.`)
    }

    return data.publicUrl
  }

  const saveRecord = async () => {
    if (!selectedHorseId) {
      alert('Choose a horse first.')
      return
    }

    if (!takenOn) {
      alert('Choose an X-ray date.')
      return
    }

    if (
      !xrayLink.trim() &&
      !reportLink.trim() &&
      !xrayFile &&
      !reportFile &&
      !note.trim() &&
      !needsSurgery &&
      !recheckOn
    ) {
      alert('Voeg minstens een link, bestand, opmerking, surgery of recheck toe.')
      return
    }

    setSaving(true)

    try {
      let xrayUrl: string | null = null
      let reportUrl: string | null = null

      if (xrayLink.trim()) {
        xrayUrl = xrayLink.trim()
      } else if (xrayFile) {
        xrayUrl = await uploadFile(xrayFile, selectedHorseId, 'xray')
      }

      if (reportLink.trim()) {
        reportUrl = reportLink.trim()
      } else if (reportFile) {
        reportUrl = await uploadFile(reportFile, selectedHorseId, 'report')
      }

      const payload = {
        horse_id: selectedHorseId,
        xray_type: xrayType,
        xray_url: xrayUrl,
        report_url: reportUrl,
        note: note.trim() || null,
        taken_on: takenOn || null,
        recheck_on: recheckOn || null,
        needs_surgery: needsSurgery,
        surgery_done: false,
      }

      console.log('XRAY INSERT PAYLOAD:', payload)

      const { error } = await supabase.from('horse_xray_records').insert(payload)

      if (error) {
        console.error('XRAY INSERT ERROR:', error)
        throw new Error(error.message)
      }

      setXrayFile(null)
      setReportFile(null)
      setXrayLink('')
      setReportLink('')
      setNote('')
      setTakenOn(todayISO())
      setRecheckOn('')
      setXrayType('general')
      setNeedsSurgery(false)

      const xrayInput = document.getElementById('xray-file') as HTMLInputElement | null
      const reportInput = document.getElementById('report-file') as HTMLInputElement | null

      if (xrayInput) xrayInput.value = ''
      if (reportInput) reportInput.value = ''

      await loadData()
    } catch (err) {
      console.error('XRAY SAVE ERROR:', err)
      alert(`Could not save: ${errorMessage(err)}`)
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
      console.error('XRAY SURGERY UPDATE ERROR:', error)
      alert(`Could not update: ${error.message}`)
      return
    }

    await loadData()
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('Delete this X-ray record?')) return

    const { error } = await supabase.from('horse_xray_records').delete().eq('id', id)

    if (error) {
      console.error('XRAY DELETE ERROR:', error)
      alert(`Could not delete: ${error.message}`)
      return
    }

    await loadData()
  }

  const formatDate = (value: string | null) => {
    if (!value) return '—'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleDateString(typeof document === 'undefined' ? 'en-GB' : document.documentElement.lang || 'en-GB')
  }

  const formatXrayType = (type: XrayType | null) => {
    if (type === '2yo') return '2Y X-ray'
    if (type === '6yo') return '6Y X-ray'
    return 'General X-ray'
  }

  return (
    <div className={`${styles.xrayPage} vet-subpage`}>
      <div className={styles.xrayTopbar}>
        <button type="button" className={styles.xrayBack} onClick={onBack}>
          ← Back
        </button>

        <div>
          <span className={styles.xrayKicker}>Diagnostics</span>
          <h2>X-rays & Reports</h2>
          <p>Horses with X-ray records and follow-up appear first. Search to find another horse.</p>
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

          <span className={styles.xrayKicker}>{search.trim() ? 'Search results' : 'X-ray cases and due checks'} · {filteredHorses.length}</span>

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
                      {getHorseDisplayName(horse)}
                      {horse.horse_number && <b className={styles.horseNumber}>No. {horse.horse_number}</b>}

                      {ageAlert === '2yo' && <b className={styles.ageBadge}>2Y due</b>}
                      {ageAlert === '6yo' && <b className={styles.ageBadgeDanger}>6Y due</b>}
                      {surgeryAlert && <b className={styles.surgeryBadge}>Surgery</b>}
                      {recheckAlert && <b className={styles.recheckBadge}>Recheck</b>}
                    </span>

                    <small>
                      {horse.horse_type || 'Horse'}
                      {horse.birth_date ? ` · ${getAge(horse)}y` : ''}
                      {' · '}
                      {count} {count === 1 ? 'record' : 'records'}
                    </small>
                  </button>
                )
              })}

            {!loading && filteredHorses.length === 0 && <div className={styles.xrayEmpty}>{search.trim() ? 'No matching horse found.' : 'No X-ray cases or due checks. Search to find a horse.'}</div>}
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
              <section className={styles.selectedHorse}>
                <div>
                  <span className={styles.xrayKicker}>Selected horse</span>
                  <h3>{getHorseDisplayName(selectedHorse)}</h3>
                  <p>{selectedHorse.horse_type || 'Horse'}{selectedHorse.birth_date ? ` · ${getAge(selectedHorse)} years old` : ''}</p>
                </div>
                {selectedHorse.horse_number && <span className={styles.horseNumberLarge}>No. {selectedHorse.horse_number}</span>}
              </section>

              <section className={styles.xrayCard}>
                <div className={styles.xrayCardHead}>
                  <div>
                    <span className={styles.xrayKicker}>Medical history</span>
                    <h3>X-rays and reports</h3>
                  </div>

                  <span className={styles.recordCount}>{selectedRecords.length} {selectedRecords.length === 1 ? 'record' : 'records'}</span>
                </div>

                <div className={styles.xrayRecordList}>
                  {selectedRecords.length === 0 && (
                    <div className={styles.xrayEmpty}>No x-rays saved yet.</div>
                  )}

                  {selectedRecords.map((record) => (
                    <article key={record.id} className={styles.xrayRecord}>
                      <div className={styles.xrayRecordTop}>
                        <div>
                          <div className={styles.recordHeading}>
                            <strong>{formatDate(record.taken_on)}</strong>
                            <span>{formatXrayType(record.xray_type)}</span>
                          </div>

                          {record.note && (
                            <span className={styles.historyRemark}>{record.note}</span>
                          )}

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
                    <span className={styles.xrayKicker}>New record</span>
                    <h3>Add an X-ray or report</h3>
                    <p className={styles.formIntro}>Enter the scan details, then attach the files or links if you have them.</p>
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

                  <div className={styles.uploadGroup}>
                    <div className={styles.uploadTitle}><strong>X-ray images</strong><span>Optional</span></div>
                    <label className={styles.uploadControl}>
                      <span>{xrayFile ? xrayFile.name : 'Choose an image or PDF'}</span>
                      <input id="xray-file" type="file" accept="image/*,.pdf" onChange={(e) => setXrayFile(e.target.files?.[0] || null)} />
                    </label>
                    <input aria-label="X-ray link" type="url" placeholder="Or paste an X-ray link" value={xrayLink} onChange={(e) => setXrayLink(e.target.value)} />
                  </div>

                  <div className={styles.uploadGroup}>
                    <div className={styles.uploadTitle}><strong>Vet report</strong><span>Optional</span></div>
                    <label className={styles.uploadControl}>
                      <span>{reportFile ? reportFile.name : 'Choose a report PDF or image'}</span>
                      <input id="report-file" type="file" accept=".pdf,image/*" onChange={(e) => setReportFile(e.target.files?.[0] || null)} />
                    </label>
                    <input aria-label="Report link" type="url" placeholder="Or paste a report link" value={reportLink} onChange={(e) => setReportLink(e.target.value)} />
                  </div>

                  <label className={styles.surgeryCheck}>
                    <input type="checkbox" checked={needsSurgery} onChange={(e) => setNeedsSurgery(e.target.checked)} />
                    <span><strong>Surgery or procedure needed</strong><small>This horse will stay flagged until it is marked done.</small></span>
                  </label>

                  <label className={styles.xrayFull}>
                    Notes
                    <textarea
                      placeholder="Add the vet's findings or anything to remember..."
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
                  {saving ? 'Saving...' : 'Save X-ray record'}
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
