'use client'

import { useMemo, useState } from 'react'
import PlaceManager from './maps/PlaceManager'
import './PlaceTab.css'

type SiteKey =
  | 'vremde'
  | 'sint-katelijne-waver'
  | 'paddock-paradise'
  | 'oostmalse-steenweg'
  | '47b'
  | '50'
  | 'goossens'
  | 'serre'
  | 'bevel'

type Site = {
  id: SiteKey
  name: string
  subtitle: string
  status: 'active' | 'setup'
}

type DragPayload = {
  horseIds: string[]
}

const SITES: Site[] = [
  { id: 'vremde', name: 'Vremde', subtitle: 'Interactieve kaart', status: 'active' },
  { id: 'sint-katelijne-waver', name: 'Sint-Katelijne-Waver', subtitle: 'Plaatsbeheer', status: 'active' },
  { id: 'bevel', name: 'Bevel', subtitle: 'Plaatsbeheer', status: 'active' },
  { id: 'paddock-paradise', name: 'Paddock Paradise', subtitle: 'Later', status: 'setup' },
  { id: 'oostmalse-steenweg', name: 'Oostmalse Steenweg', subtitle: 'Later', status: 'setup' },
  { id: '47b', name: '47B', subtitle: 'Later', status: 'setup' },
  { id: '50', name: '50', subtitle: 'Later', status: 'setup' },
  { id: 'goossens', name: 'Goossens', subtitle: 'Later', status: 'setup' },
  { id: 'serre', name: 'Serre', subtitle: 'Later', status: 'setup' },
]

function getDraggedHorseIdsFromEvent(e: React.DragEvent) {
  try {
    const raw = e.dataTransfer.getData('application/json')
    if (raw) {
      const parsed = JSON.parse(raw) as DragPayload
      return parsed.horseIds ?? []
    }
  } catch {
    //
  }

  const fallback = e.dataTransfer.getData('text/plain')
  if (!fallback) return []
  return fallback.split(',').map((v) => v.trim()).filter(Boolean)
}

export default function PlaceTab() {
  const [activeSiteId, setActiveSiteId] = useState<SiteKey>('vremde')

  const [pendingSiteDrop, setPendingSiteDrop] = useState<{
    horseIds: string[]
    targetSiteSlug: SiteKey
  } | null>(null)

  const activeSite = useMemo(
    () => SITES.find((site) => site.id === activeSiteId) ?? SITES[0],
    [activeSiteId]
  )

  function allowDrop(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDropOnSite(siteId: SiteKey, e: React.DragEvent) {
    e.preventDefault()

    const horseIds = getDraggedHorseIdsFromEvent(e)
    if (!horseIds.length) return

    setPendingSiteDrop({
      horseIds,
      targetSiteSlug: siteId,
    })

    setActiveSiteId(siteId)
  }

  return (
    <div className="place-tab-shell">
      <div className="place-tab-hero">
        <div>
          <span className="place-tab-kicker">Facility management</span>
          <h2 className="place-tab-title">Place</h2>
          <p className="place-tab-subtitle">
            Beheer je sites, weides, gebouwen en paarden vanuit één omgeving.
          </p>
        </div>

        <div className="place-tab-hero-stats">
          <div className="place-tab-stat-card">
            <span>Sites</span>
            <strong>{SITES.length}</strong>
          </div>
          <div className="place-tab-stat-card">
            <span>Actieve locatie</span>
            <strong>{activeSite.name}</strong>
          </div>
        </div>
      </div>

      <div className="place-tab-layout">
        <aside className="place-tab-sidebar">
          <div className="place-tab-panel-head">
            <div>
              <p className="place-tab-eyebrow">Sites</p>
              <h3>Locaties</h3>
            </div>
          </div>

          <div className="place-tab-site-list">
            {SITES.map((site) => (
              <button
                key={site.id}
                type="button"
                className={`place-tab-site-card ${activeSiteId === site.id ? 'active' : ''}`}
                onClick={() => setActiveSiteId(site.id)}
                onDragOver={allowDrop}
                onDrop={(e) => handleDropOnSite(site.id, e)}
              >
                <div className="place-tab-site-top">
                  <h4>{site.name}</h4>
                  <span
                    className={`place-tab-site-badge ${
                      site.status === 'active' ? 'active' : 'setup'
                    }`}
                  >
                    {site.status === 'active' ? 'live' : 'setup'}
                  </span>
                </div>

                <p>{site.subtitle}</p>

                <div className="place-tab-site-drop-note">Sleep paarden hierheen</div>
              </button>
            ))}
          </div>
        </aside>

        <section className="place-tab-main">
          <PlaceManager
            siteSlug={activeSite.id}
            siteLabel={activeSite.name}
            pendingSiteDrop={pendingSiteDrop}
            onClearPendingSiteDrop={() => setPendingSiteDrop(null)}
          />
        </section>
      </div>
    </div>
  )
}