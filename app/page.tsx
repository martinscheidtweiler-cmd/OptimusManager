'use client'

import { useMemo, useState } from 'react'
import { Inter, Cormorant_Garamond } from 'next/font/google'

import PlanningTab from '@/app/components/PlanningTab/PlanningTab'
import HorsesTab from '@/app/components/HorsesTab/HorsesTab'
import FarrierTab from '@/app/components/FarrierTab/FarrierTab'
import VetTab from '@/app/components/VetTab/VetTab'
import PlaceTab from '@/app/components/PlaceTab/PlaceTab'
import OperationsTab from '@/app/components/OperationsTab/OperationsTab'

import './page.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
})

type Tab =
  | 'Horses'
  | 'Riders'
  | 'Tasks'
  | 'Planning'
  | 'Vet'
  | 'Farrier'
  | 'Place'

type MenuItem = {
  key: Tab
  label: string
  subtitle?: string
}

const sideMenu: MenuItem[] = [
  {
    key: 'Horses',
    label: 'Horses',
    subtitle: 'Stable overview',
  },
  {
    key: 'Riders',
    label: 'Riders',
    subtitle: 'Work & riders',
  },
  {
    key: 'Tasks',
    label: 'Tasks',
    subtitle: 'Daily operations',
  },
]

const topMenu: MenuItem[] = [
  {
    key: 'Planning',
    label: 'Planning',
  },
  {
    key: 'Vet',
    label: 'Vet',
  },
  {
    key: 'Farrier',
    label: 'Farrier',
  },
  {
    key: 'Place',
    label: 'Place',
  },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('Horses')
  const [vetResetKey, setVetResetKey] = useState(0)
  const [farrierResetKey, setFarrierResetKey] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const activeLabel = useMemo(() => {
    const allItems = [...sideMenu, ...topMenu]

    return allItems.find((item) => item.key === activeTab)?.label ?? activeTab
  }, [activeTab])

  const handleTabClick = (tab: Tab) => {
    setMobileMenuOpen(false)

    if (tab === 'Vet') {
      setActiveTab('Vet')
      setVetResetKey((prev) => prev + 1)
      return
    }

    if (tab === 'Farrier') {
      setActiveTab('Farrier')
      setFarrierResetKey((prev) => prev + 1)
      return
    }

    setActiveTab(tab)
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Horses':
        return <HorsesTab />

      case 'Planning':
        return <PlanningTab />

      case 'Farrier':
        return <FarrierTab key={farrierResetKey} />

      case 'Vet':
        return <VetTab key={vetResetKey} />

      case 'Place':
        return <PlaceTab />

      case 'Tasks':
        return <OperationsTab />

      case 'Riders':
        return (
          <div className="om-plain-content">
            <span className="om-kicker">Rider Management</span>

            <h2 className="om-title">Riders</h2>

            <p className="om-text">
              Keep rider planning, working hours, horse notes and daily
              responsibilities together.
            </p>

            <div className="om-coming-grid">
              <div className="om-coming-card">
                <strong>Terry</strong>
                <span>
                  Main rider · variable start time · sport horses
                </span>
              </div>

              <div className="om-coming-card">
                <strong>Lot & Zanna</strong>
                <span>
                  Riding interns · riding support · walker and turnout help
                </span>
              </div>

              <div className="om-coming-card">
                <strong>Lenne</strong>
                <span>
                  Morning operations · walker flow · turnout management
                </span>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <main className={`om-layout ${inter.variable} ${cormorant.variable}`}>
      <aside className={`om-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="om-logo">
          <span className="om-logo-dot" />

          <div>
            <h1>Optimus</h1>
            <p>Manager</p>
          </div>
        </div>

        <nav className="om-side-nav" aria-label="Main navigation">
          {sideMenu.map((item) => (
            <button
              key={item.key}
              className={`om-side-link ${
                activeTab === item.key ? 'active' : ''
              }`}
              onClick={() => handleTabClick(item.key)}
              type="button"
            >
              <span>{item.label}</span>

              {item.subtitle ? <small>{item.subtitle}</small> : null}
            </button>
          ))}
        </nav>
      </aside>

      <section className="om-main">
        <header className="om-topbar">
          <button
            className="om-mobile-toggle"
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="om-mobile-current">
            <span>Current module</span>
            <strong>{activeLabel}</strong>
          </div>

          <div className="om-top-links" aria-label="Module navigation">
            {topMenu.map((item) => (
              <button
                key={item.key}
                className={`om-top-link ${
                  activeTab === item.key ? 'active' : ''
                }`}
                onClick={() => handleTabClick(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </header>

        {mobileMenuOpen ? (
          <button
            className="om-mobile-backdrop"
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
        ) : null}

        <div className="om-content">{renderContent()}</div>
      </section>
    </main>
  )
}