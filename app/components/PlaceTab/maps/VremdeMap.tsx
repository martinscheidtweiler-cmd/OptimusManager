'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/app/lib/supabaseClient'
import './VremdeMap.css'

type ZoneStatus = 'available' | 'rest' | 'warning' | 'building'

type UnitRow = {
  id: string
  site_id: string
  area_id: string | null
  parent_unit_id: string | null
  name: string
  slug: string | null
  unit_type: string
  description: string | null
  capacity: number
  active: boolean
  sort_order: number
}

type HorsePlaceRow = {
  assignment_id: string
  horse_id: string
  horse_name: string
  horse_active: boolean | null
  site_id: string
  site_name: string
  area_id: string | null
  area_name: string | null
  area_type: string | null
  unit_id: string | null
  unit_name: string | null
  unit_type: string | null
  assigned_at: string
  moved_by: string | null
  move_note: string | null
}

type SiteRow = {
  id: string
  name: string
  slug: string
}

type Zone = {
  id: string
  name: string
  type: 'pasture' | 'building'
  status: ZoneStatus
  horses: number
  grassHeight?: number | null
  lastGrazing?: string | null
  restDays?: number | null
  points: string
  labelX: number
  labelY: number
}

const MAP_ZONES: Zone[] = [
  {
    id: 'vremde-1',
    name: 'Weide 1',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 8,
    lastGrazing: '14/03/2026',
    restDays: 0,
    points: '137,66 233,66 233,224 94,213 94,116 137,116',
    labelX: 165,
    labelY: 150,
  },
  {
    id: 'vremde-2',
    name: 'Weide 2',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 7,
    lastGrazing: '12/03/2026',
    restDays: 0,
    points: '15,208 94,213 94,260 15,260',
    labelX: 54,
    labelY: 236,
  },
  {
    id: 'vremde-3',
    name: 'Weide 3',
    type: 'pasture',
    status: 'rest',
    horses: 0,
    grassHeight: 6,
    lastGrazing: '16/03/2026',
    restDays: 5,
    points: '15,260 137,260 137,358 15,359',
    labelX: 76,
    labelY: 309,
  },
  {
    id: 'vremde-4',
    name: 'Weide 4',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 9,
    lastGrazing: '10/03/2026',
    restDays: 0,
    points: '137,260 261,274 261,389 137,421',
    labelX: 196,
    labelY: 336,
  },
  {
    id: 'vremde-5',
    name: 'Weide 5',
    type: 'pasture',
    status: 'warning',
    horses: 0,
    grassHeight: 4,
    lastGrazing: '17/03/2026',
    restDays: 7,
    points: '15,359 137,358 137,421 15,438',
    labelX: 76,
    labelY: 397,
  },
  {
    id: 'vremde-6',
    name: 'Weide 6',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 8,
    lastGrazing: '11/03/2026',
    restDays: 0,
    points: '137,421 293,421 293,438 293,588 137,588',
    labelX: 214,
    labelY: 500,
  },
  {
    id: 'vremde-7',
    name: 'Weide 7',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 7,
    lastGrazing: '13/03/2026',
    restDays: 0,
    points: '293,438 440,438 440,589 293,588',
    labelX: 366,
    labelY: 512,
  },
  {
    id: 'vremde-8',
    name: 'Weide 8',
    type: 'pasture',
    status: 'available',
    horses: 0,
    grassHeight: 9,
    lastGrazing: '09/03/2026',
    restDays: 0,
    points: '440,359 613,482 528,588 440,588',
    labelX: 515,
    labelY: 500,
  },
  {
    id: 'vremde-9',
    name: 'Weide 9',
    type: 'building',
    status: 'building',
    horses: 0,
    points: '261,212 293,212 293,274 261,274',
    labelX: 277,
    labelY: 244,
  },
  {
    id: 'vremde-10',
    name: 'Weide 10',
    type: 'building',
    status: 'building',
    horses: 0,
    points: '261,250 293,250 293,421 261,421',
    labelX: 277,
    labelY: 336,
  },
]

function getStatusLabel(status: ZoneStatus) {
  switch (status) {
    case 'available':
      return 'Beschikbaar'
    case 'rest':
      return 'Rust nodig'
    case 'warning':
      return 'Waarschuwing'
    case 'building':
      return 'Gebouw'
    default:
      return 'Onbekend'
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('nl-BE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function VremdeMap() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [units, setUnits] = useState<UnitRow[]>([])
  const [horsePlaces, setHorsePlaces] = useState<HorsePlaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string>(MAP_ZONES[0].id)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const { data: sitesData, error: sitesError } = await supabase
          .from('sites')
          .select('id, name, slug')
          .eq('slug', 'vremde')
          .limit(1)

        if (sitesError) throw sitesError

        const vremdeSite = sitesData?.[0]
        if (!vremdeSite) {
          throw new Error('Site "vremde" niet gevonden in Supabase.')
        }

        setSites(sitesData as SiteRow[])

        const [unitsRes, horsesRes] = await Promise.all([
          supabase
            .from('place_units')
            .select('*')
            .eq('site_id', vremdeSite.id)
            .eq('active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true }),

          supabase
            .from('horse_current_places_v2')
            .select('*')
            .eq('site_id', vremdeSite.id)
            .order('horse_name', { ascending: true }),
        ])

        if (unitsRes.error) throw unitsRes.error
        if (horsesRes.error) throw horsesRes.error

        setUnits((unitsRes.data ?? []) as UnitRow[])
        setHorsePlaces(
          ((horsesRes.data ?? []) as HorsePlaceRow[]).filter(
            (item) => item.horse_active !== false
          )
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Fout bij laden van Vremde map'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const selectedZone = useMemo(
    () => MAP_ZONES.find((zone) => zone.id === selectedId) ?? MAP_ZONES[0],
    [selectedId]
  )

  const selectedUnit = useMemo(() => {
    return units.find(
      (unit) => unit.name.trim().toLowerCase() === selectedZone.name.trim().toLowerCase()
    ) ?? null
  }, [units, selectedZone])

  const horsesInSelectedZone = useMemo(() => {
    if (!selectedUnit) return []
    return horsePlaces.filter((item) => item.unit_id === selectedUnit.id)
  }, [horsePlaces, selectedUnit])

  const warnings = useMemo(() => {
    return MAP_ZONES.filter((zone) => zone.status === 'rest' || zone.status === 'warning')
  }, [])

  const zonesWithHorseCounts = useMemo(() => {
    return MAP_ZONES.map((zone) => {
      const unit = units.find(
        (item) => item.name.trim().toLowerCase() === zone.name.trim().toLowerCase()
      )

      const count = unit
        ? horsePlaces.filter((item) => item.unit_id === unit.id).length
        : 0

      return {
        ...zone,
        horses: count,
      }
    })
  }, [units, horsePlaces])

  const selectedZoneWithCount = useMemo(() => {
    return zonesWithHorseCounts.find((zone) => zone.id === selectedId) ?? zonesWithHorseCounts[0]
  }, [zonesWithHorseCounts, selectedId])

  return (
    <div className="vremde-map-shell">
      <div className="vremde-map-main">
        <div className="vremde-map-stage">
          <img
            src="/maps/vremde-map.png"
            alt="Vremde map"
            className="vremde-map-image"
          />

          <svg
            className="vremde-map-overlay"
            viewBox="0 0 629 628"
            preserveAspectRatio="none"
          >
            {zonesWithHorseCounts.map((zone) => (
              <g key={zone.id}>
                <polygon
                  points={zone.points}
                  className={`vremde-zone vremde-zone--${zone.status} ${
                    selectedId === zone.id ? 'is-active' : ''
                  }`}
                  onClick={() => setSelectedId(zone.id)}
                />
                <text
                  x={zone.labelX}
                  y={zone.labelY}
                  className="vremde-zone-label"
                  textAnchor="middle"
                  onClick={() => setSelectedId(zone.id)}
                >
                  {zone.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <aside className="vremde-map-sidebar">
        <div className="vremde-sidebar-card">
          <h3>Vremde</h3>
          <p className="vremde-sidebar-subtitle">Weidebeheer overzicht</p>
          {loading ? <p className="vremde-sidebar-subtitle">Data laden...</p> : null}
          {error ? <p className="vremde-error-text">{error}</p> : null}
        </div>

        <div className="vremde-sidebar-card">
          <h4>Geselecteerde zone</h4>

          <div className="vremde-detail-head">
            <span className={`vremde-status-pill vremde-status-pill--${selectedZone.status}`}>
              {getStatusLabel(selectedZone.status)}
            </span>
            <strong>{selectedZone.name}</strong>
          </div>

          <div className="vremde-detail-grid">
            <div className="vremde-detail-item">
              <span>Type</span>
              <strong>{selectedZone.type === 'building' ? 'Gebouw' : 'Weide'}</strong>
            </div>

            <div className="vremde-detail-item">
              <span>Paarden</span>
              <strong>{selectedZoneWithCount.horses}</strong>
            </div>

            <div className="vremde-detail-item">
              <span>Laatste begrazing</span>
              <strong>{selectedZone.lastGrazing ?? '—'}</strong>
            </div>

            <div className="vremde-detail-item">
              <span>Grashoogte</span>
              <strong>
                {selectedZone.grassHeight !== undefined && selectedZone.grassHeight !== null
                  ? `${selectedZone.grassHeight} cm`
                  : '—'}
              </strong>
            </div>

            <div className="vremde-detail-item">
              <span>Rustperiode</span>
              <strong>
                {selectedZone.restDays !== undefined && selectedZone.restDays !== null
                  ? `${selectedZone.restDays} dagen`
                  : '—'}
              </strong>
            </div>

            <div className="vremde-detail-item">
              <span>Database unit</span>
              <strong>{selectedUnit?.name ?? 'Niet gekoppeld'}</strong>
            </div>
          </div>

          <button type="button" className="vremde-primary-btn">
            Details bekijken
          </button>
        </div>

        <div className="vremde-sidebar-card">
          <h4>Paarden in deze zone</h4>

          <div className="vremde-horse-list">
            {horsesInSelectedZone.length ? (
              horsesInSelectedZone.map((horse) => (
                <div key={horse.horse_id} className="vremde-horse-item">
                  <strong>{horse.horse_name}</strong>
                  <span>Sinds {formatDate(horse.assigned_at)}</span>
                </div>
              ))
            ) : (
              <div className="vremde-empty-box">
                Geen actieve paarden in deze zone.
              </div>
            )}
          </div>
        </div>

        <div className="vremde-sidebar-card">
          <h4>Waarschuwingen</h4>

          <div className="vremde-warning-list">
            {warnings.map((zone) => (
              <button
                key={zone.id}
                type="button"
                className="vremde-warning-item"
                onClick={() => setSelectedId(zone.id)}
              >
                <span className={`vremde-warning-dot vremde-warning-dot--${zone.status}`} />
                <div>
                  <strong>{zone.name}</strong>
                  <p>
                    {zone.status === 'rest'
                      ? `${zone.restDays ?? 0} dagen rust nodig`
                      : `Gras te kort (${zone.grassHeight ?? 0} cm)`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}