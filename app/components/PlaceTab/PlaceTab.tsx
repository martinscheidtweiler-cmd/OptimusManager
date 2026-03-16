'use client'

import { useMemo, useState } from 'react'
import VremdeMap from './maps/VremdeMap'
import './PlaceTab.css'

type SiteKey = 'vremde' | 'broechem' | 'bevel' | 'sint-katelijne-waver'

type Site = {
  id: SiteKey
  name: string
  subtitle: string
  status: 'active' | 'setup'
  horses: number
  pastures: number
  buildings: number
}

const SITES: Site[] = [
  {
    id: 'vremde',
    name: 'Vremde',
    subtitle: 'Interactieve weidekaart',
    status: 'active',
    horses: 26,
    pastures: 8,
    buildings: 2,
  },
  {
    id: 'broechem',
    name: 'Broechem',
    subtitle: 'Groot complex met meerdere stallen',
    status: 'setup',
    horses: 0,
    pastures: 0,
    buildings: 0,
  },
  {
    id: 'bevel',
    name: 'Bevel',
    subtitle: 'Grote weide / buitenlocatie',
    status: 'setup',
    horses: 0,
    pastures: 0,
    buildings: 0,
  },
  {
    id: 'sint-katelijne-waver',
    name: 'Sint-Katelijne-Waver',
    subtitle: 'Tweede complex',
    status: 'setup',
    horses: 0,
    pastures: 0,
    buildings: 0,
  },
]

export default function PlaceTab() {
  const [activeSiteId, setActiveSiteId] = useState<SiteKey>('vremde')

  const activeSite = useMemo(
    () => SITES.find((site) => site.id === activeSiteId) ?? SITES[0],
    [activeSiteId]
  )

  const renderMainContent = () => {
    switch (activeSiteId) {
      case 'vremde':
        return <VremdeMap />

      case 'broechem':
        return (
          <div className="place-coming-soon">
            <span className="place-coming-soon-kicker">In opbouw</span>
            <h3>Broechem map</h3>
            <p>
              Hier komt de grote interactieve kaart van Broechem met stallen, weides,
              polygonen en verplaatsingen.
            </p>
          </div>
        )

      case 'bevel':
        return (
          <div className="place-coming-soon">
            <span className="place-coming-soon-kicker">In opbouw</span>
            <h3>Bevel map</h3>
            <p>
              Hier komt de kaart van Bevel. Ideaal voor grote buitenweides en rotatiebeheer.
            </p>
          </div>
        )

      case 'sint-katelijne-waver':
        return (
          <div className="place-coming-soon">
            <span className="place-coming-soon-kicker">In opbouw</span>
            <h3>Sint-Katelijne-Waver map</h3>
            <p>
              Hier komt de interactieve kaart van Sint-Katelijne-Waver met zones en plaatsbeheer.
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="place-tab-shell">
      <div className="place-tab-hero">
        <div>
          <span className="place-tab-kicker">Facility management</span>
          <h2 className="place-tab-title">Place</h2>
          <p className="place-tab-subtitle">
            Beheer je sites, weides, gebouwen en later ook boxen vanuit één visuele kaartomgeving.
          </p>
        </div>

        <div className="place-tab-hero-stats">
          <div className="place-tab-stat-card">
            <span>Sites</span>
            <strong>{SITES.length}</strong>
          </div>
          <div className="place-tab-stat-card">
            <span>Actieve kaart</span>
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

                <div className="place-tab-site-meta">
                  <span>{site.horses} paarden</span>
                  <span>{site.pastures} weides</span>
                  <span>{site.buildings} gebouwen</span>
                </div>
              </button>
            ))}
          </div>

          <div className="place-tab-sidebar-note">
            <h4>Volgende stap</h4>
            <p>
              Eerst werken we Vremde volledig af. Daarna kopiëren we dezelfde structuur naar
              Broechem, Bevel en Sint-Katelijne-Waver.
            </p>
          </div>
        </aside>

        <section className="place-tab-main">
          <div className="place-tab-panel-head">
            <div>
              <p className="place-tab-eyebrow">Kaart</p>
              <h3>{activeSite.name}</h3>
            </div>
          </div>

          {renderMainContent()}
        </section>
      </div>
    </div>
  )
}