'use client'

import { useState } from 'react'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import PlanningTab from '@/app/components/PlanningTab/PlanningTab'
import HorsesTab from '@/app/components/HorsesTab/HorsesTab'
import FarrierTab from '@/app/components/FarrierTab/FarrierTab'
import VetTab from '@/app/components/VetTab/VetTab'
import PlaceTab from '@/app/components/PlaceTab/PlaceTab'
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

type Tab = 'Horses' | 'Riders' | 'Tasks' | 'Planning' | 'Vet' | 'Farrier' | 'Place'

export default function Home() {
  const sideMenu: Tab[] = ['Horses', 'Riders', 'Tasks']
  const topMenu: Tab[] = ['Planning', 'Vet', 'Farrier', 'Place']

  const [activeTab, setActiveTab] = useState<Tab>('Horses')
  const [vetResetKey, setVetResetKey] = useState(0)
  const [farrierResetKey, setFarrierResetKey] = useState(0)

  const handleTabClick = (tab: Tab) => {
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

      case 'Riders':
        return (
          <div className="om-plain-content">
            <span className="om-kicker">Rider Management</span>
            <h2 className="om-title">Riders</h2>
            <p className="om-text">
              Keep rider planning, hours, notes and responsibilities together.
            </p>
          </div>
        )

      case 'Tasks':
        return (
          <div className="om-plain-content">
            <span className="om-kicker">Stable Tasks</span>
            <h2 className="om-title">Tasks</h2>
            <p className="om-text">
              Organise daily stable work and team follow-up in one place.
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <main className={`om-layout ${inter.variable} ${cormorant.variable}`}>
      <aside className="om-sidebar">
        <div className="om-logo">
          <span className="om-logo-dot" />
          <div>
            <h1>Optimus</h1>
            <p>Manager</p>
          </div>
        </div>

        <nav className="om-side-nav">
          {sideMenu.map((item) => (
            <button
              key={item}
              className={`om-side-link ${activeTab === item ? 'active' : ''}`}
              onClick={() => handleTabClick(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      <section className="om-main">
        <header className="om-topbar">
          <div className="om-top-links">
            {topMenu.map((item) => (
              <button
                key={item}
                className={`om-top-link ${activeTab === item ? 'active' : ''}`}
                onClick={() => handleTabClick(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <div className="om-content">{renderContent()}</div>
      </section>
    </main>
  )
}