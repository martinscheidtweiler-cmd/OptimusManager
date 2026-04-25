'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import styles from './LabResultsTab.module.css'

type TestType = 'blood' | 'foal_blood' | 'fecal'
type ResultStatus = 'waiting' | 'partial' | 'completed'

type Horse = {
  id: string
  name: string
  active: boolean | null
}

type LabResult = {
  id: string
  horse_id: string
  test_type: TestType
  sample_taken_on: string
  result_status: ResultStatus
  partial_file_url: string | null
  final_file_url: string | null
  summary: string | null
  notes: string | null
  created_at: string
}

type Props = {
  onBack: () => void
}

export default function LabResultsTab({ onBack }: Props) {
  const [horses, setHorses] = useState<Horse[]>([])
  const [records, setRecords] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [openRecordId, setOpenRecordId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | ResultStatus>('all')

  const [horseId, setHorseId] = useState('')
  const [testType, setTestType] = useState<TestType>('blood')
  const [sampleDate, setSampleDate] = useState(() => new Date().toISOString().slice(0, 10))

  const loadData = async () => {
    setLoading(true)

    try {
      const [{ data: horsesData, error: horsesError }, { data: recordsData, error: recordsError }] =
        await Promise.all([
          supabase
            .from('horses')
            .select('id, name, active')
            .eq('active', true)
            .order('name', { ascending: true }),

          supabase
            .from('horse_lab_results')
            .select(`
              id,
              horse_id,
              test_type,
              sample_taken_on,
              result_status,
              partial_file_url,
              final_file_url,
              summary,
              notes,
              created_at
            `)
            .order('sample_taken_on', { ascending: false }),
        ])

      if (horsesError) throw horsesError
      if (recordsError) throw recordsError

      setHorses((horsesData || []) as Horse[])
      setRecords((recordsData || []) as LabResult[])
    } catch (err) {
      console.error('Error loading lab results:', err)
      setHorses([])
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const horseName = (id: string) => {
    return horses.find((horse) => horse.id === id)?.name || 'Unknown horse'
  }

  const filteredRecords = useMemo(() => {
    const statusOrder: Record<ResultStatus, number> = {
      waiting: 1,
      partial: 2,
      completed: 3,
    }

    return records
      .filter((record) => {
        const q = search.toLowerCase()
        const name = horseName(record.horse_id).toLowerCase()

        const matchesSearch =
          name.includes(q) ||
          record.test_type.toLowerCase().includes(q) ||
          (record.summary || '').toLowerCase().includes(q) ||
          (record.notes || '').toLowerCase().includes(q)

        const matchesStatus = statusFilter === 'all' ? true : record.result_status === statusFilter

        return matchesSearch && matchesStatus
      })
      .sort((a, b) => {
        const statusDiff = statusOrder[a.result_status] - statusOrder[b.result_status]
        if (statusDiff !== 0) return statusDiff

        return new Date(b.sample_taken_on).getTime() - new Date(a.sample_taken_on).getTime()
      })
  }, [records, horses, search, statusFilter])

  const waitingCount = records.filter((record) => record.result_status === 'waiting').length
  const partialCount = records.filter((record) => record.result_status === 'partial').length
  const completedCount = records.filter((record) => record.result_status === 'completed').length

  const saveSample = async () => {
    if (!horseId) return alert('Select horse.')
    if (!sampleDate) return alert('Choose a date.')

    setSaving(true)

    try {
      const { error } = await supabase.from('horse_lab_results').insert({
        horse_id: horseId,
        test_type: testType,
        sample_taken_on: sampleDate,
        sample_sent_on: sampleDate,
        result_status: 'waiting',
      })

      if (error) throw error

      setHorseId('')
      setTestType('blood')
      setSampleDate(new Date().toISOString().slice(0, 10))
      setShowForm(false)

      await loadData()
    } catch (err: any) {
      console.error('Error saving lab sample:', err)
      alert(err?.message || err?.details || JSON.stringify(err) || 'Saving failed.')
    } finally {
      setSaving(false)
    }
  }

  const updateRecord = async (id: string, payload: Partial<LabResult>) => {
    const { error } = await supabase.from('horse_lab_results').update(payload).eq('id', id)

    if (error) {
      console.error('Error updating lab result:', error)
      alert(error.message || 'Update failed.')
      return
    }

    await loadData()
  }

  const uploadFile = async (record: LabResult, file: File, kind: 'partial' | 'final') => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      alert('Upload PDF only.')
      return
    }

    setUploadingId(`${record.id}-${kind}`)

    try {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase()

      const path = `${record.horse_id}/${record.id}/${kind}-${Date.now()}-${cleanName}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('horse-lab-results')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('horse-lab-results').getPublicUrl(path)

      const payload =
        kind === 'partial'
          ? {
              partial_file_url: data.publicUrl,
              result_status: 'partial' as ResultStatus,
              partial_result_on: new Date().toISOString().slice(0, 10),
            }
          : {
              final_file_url: data.publicUrl,
              result_status: 'completed' as ResultStatus,
              final_result_on: new Date().toISOString().slice(0, 10),
            }

      const { error: updateError } = await supabase
        .from('horse_lab_results')
        .update(payload)
        .eq('id', record.id)

      if (updateError) throw updateError

      await loadData()
    } catch (err: any) {
      console.error('Error uploading lab file:', err)
      alert(err?.message || err?.details || JSON.stringify(err) || 'Upload failed.')
    } finally {
      setUploadingId(null)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('Delete this sample?')) return

    const { error } = await supabase.from('horse_lab_results').delete().eq('id', id)

    if (error) {
      console.error('Error deleting lab sample:', error)
      alert('Delete failed.')
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

  const formatTestType = (type: TestType) => {
    if (type === 'blood') return 'Blood'
    if (type === 'foal_blood') return 'Foal blood'
    return 'Feces'
  }

  const formatStatus = (status: ResultStatus) => {
    if (status === 'waiting') return 'No result yet'
    if (status === 'partial') return 'Partial result'
    return 'Final result'
  }

  return (
    <div className={styles.labPage}>
      <div className={styles.labTopbar}>
        <button type="button" className={styles.labBack} onClick={onBack}>
          ← Back
        </button>

        <div>
          <span className={styles.labKicker}>Diagnostics</span>
          <h2>Lab Results</h2>
          <p>Sample list for blood, foal blood and feces tests.</p>
        </div>

        <button
          type="button"
          className={styles.addButton}
          onClick={() => setShowForm((prev) => !prev)}
        >
          {showForm ? 'Close' : '+ Add sample'}
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCardDanger}>
          <span>No result yet</span>
          <strong>{waitingCount}</strong>
        </div>

        <div className={styles.statCardWarning}>
          <span>Partial result</span>
          <strong>{partialCount}</strong>
        </div>

        <div className={styles.statCardSuccess}>
          <span>Final result</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      {showForm && (
        <section className={`${styles.labCard} ${styles.formCard}`}>
          <div className={styles.cardHead}>
            <div>
              <span className={styles.labKicker}>Add sample</span>
              <h3>New sample</h3>
            </div>
          </div>

          <div className={styles.formGrid}>
            <label>
              Horse
              <select value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                <option value="">Select horse</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                value={sampleDate}
                onChange={(e) => setSampleDate(e.target.value)}
              />
            </label>

            <label>
              Test type
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as TestType)}
              >
                <option value="blood">Blood</option>
                <option value="foal_blood">Foal blood</option>
                <option value="fecal">Feces</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            className={styles.saveButton}
            onClick={saveSample}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save sample'}
          </button>
        </section>
      )}

      <section className={styles.labCard}>
        <div className={styles.toolbar}>
          <input
            className={styles.searchInput}
            placeholder="Search horse, type or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">All samples</option>
            <option value="waiting">No result yet</option>
            <option value="partial">Partial result</option>
            <option value="completed">Final result</option>
          </select>
        </div>

        <div className={styles.sampleList}>
          {loading && <div className={styles.empty}>Loading samples...</div>}

          {!loading && filteredRecords.length === 0 && (
            <div className={styles.empty}>No samples found.</div>
          )}

          {!loading &&
            filteredRecords.map((record) => {
              const isOpen = openRecordId === record.id

              return (
                <article
                  key={record.id}
                  className={`${styles.sampleCard} ${
                    record.result_status === 'waiting'
                      ? styles.cardWaiting
                      : record.result_status === 'partial'
                        ? styles.cardPartial
                        : styles.cardDone
                  }`}
                >
                  <button
                    type="button"
                    className={styles.sampleSummary}
                    onClick={() => setOpenRecordId(isOpen ? null : record.id)}
                  >
                    <div className={styles.sampleMainInfo}>
                      <span className={styles.sampleDate}>
                        {formatDate(record.sample_taken_on)}
                      </span>

                      <strong>{horseName(record.horse_id)}</strong>

                      <small>{formatTestType(record.test_type)}</small>

                      {record.summary && (
                        <p className={styles.summaryPreview}>{record.summary}</p>
                      )}
                    </div>

                    <div className={styles.badges}>
                      <span
                        className={
                          record.result_status === 'completed'
                            ? styles.statusDone
                            : record.result_status === 'partial'
                              ? styles.statusPartial
                              : styles.statusWaiting
                        }
                      >
                        {formatStatus(record.result_status)}
                      </span>

                      {record.partial_file_url && (
                        <span className={styles.fileBadge}>Partial PDF</span>
                      )}

                      {record.final_file_url && <span className={styles.fileBadge}>Final PDF</span>}
                    </div>

                    <span className={styles.arrow}>{isOpen ? '↑' : '↓'}</span>
                  </button>

                  {isOpen && (
                    <div className={styles.sampleDetail}>
                      <div className={styles.fileUploadGrid}>
                        <div className={styles.fileBox}>
                          <div>
                            <span className={styles.labKicker}>Partial result</span>
                            <strong>
                              {record.partial_file_url ? 'Partial PDF uploaded' : 'No partial PDF'}
                            </strong>
                          </div>

                          <div className={styles.fileActions}>
                            {record.partial_file_url && (
                              <a
                                href={record.partial_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.openFileButton}
                              >
                                Open
                              </a>
                            )}

                            <label className={styles.uploadFileButton}>
                              {uploadingId === `${record.id}-partial`
                                ? 'Uploading...'
                                : 'Upload partial'}
                              <input
                                type="file"
                                accept="application/pdf,.pdf"
                                disabled={uploadingId === `${record.id}-partial`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) uploadFile(record, file, 'partial')
                                  e.currentTarget.value = ''
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className={styles.fileBox}>
                          <div>
                            <span className={styles.labKicker}>Final result</span>
                            <strong>
                              {record.final_file_url ? 'Final PDF uploaded' : 'No final PDF'}
                            </strong>
                          </div>

                          <div className={styles.fileActions}>
                            {record.final_file_url && (
                              <a
                                href={record.final_file_url}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.openFileButton}
                              >
                                Open
                              </a>
                            )}

                            <label className={styles.uploadFileButton}>
                              {uploadingId === `${record.id}-final`
                                ? 'Uploading...'
                                : 'Upload final'}
                              <input
                                type="file"
                                accept="application/pdf,.pdf"
                                disabled={uploadingId === `${record.id}-final`}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) uploadFile(record, file, 'final')
                                  e.currentTarget.value = ''
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <label className={styles.summaryBox}>
                        Summary / remarks
                        <textarea
                          defaultValue={record.summary || ''}
                          placeholder="Write a short summary of the result..."
                          onBlur={(e) =>
                            updateRecord(record.id, {
                              summary: e.target.value.trim() || null,
                            })
                          }
                        />
                      </label>

                      <div className={styles.footerActions}>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => deleteRecord(record.id)}
                        >
                          Delete sample
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
        </div>
      </section>
    </div>
  )
}