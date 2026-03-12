'use client'

import { useState } from 'react'
import './VetTab.css'
import MedicinesTab from './MedicinesTab'

type VetMenu =
  | 'Xray'
  | 'Labo Results'
  | 'Wim Vermeiren'
  | 'Treatments'
  | 'Vaccinations'
  | 'Mares'
  | 'Births'
  | 'Medicines'

const menuItems: {
  key: VetMenu
  title: string
  text: string
}[] = [
  { key: 'Xray', title: 'Xray', text: 'Scans en beeldvorming' },
  { key: 'Labo Results', title: 'Labo Results', text: 'Bloedanalyse en laboresultaten' },
  { key: 'Wim Vermeiren', title: 'Wim Vermeiren', text: 'Bezoeken en opvolging' },
  { key: 'Treatments', title: 'Treatments', text: 'Behandelingen en medicatie' },
  { key: 'Vaccinations', title: 'Vaccinations', text: 'Vaccins en planning' },
  { key: 'Medicines', title: 'Medicines', text: 'Geneesmiddelenregister' },
  { key: 'Mares', title: 'Mares', text: 'Merrie opvolging' },
  { key: 'Births', title: 'Births', text: 'Veulens en geboortes' },
]

export default function VetTab() {
  const [activeMenu, setActiveMenu] = useState<VetMenu | null>(null)

  if (activeMenu === 'Medicines') {
    return <MedicinesTab />
  }

  return (
    <div className="om-plain-content">
      <span className="om-kicker">Health Management</span>
      <h2 className="om-title">Vet</h2>

      <div className="vet-menu-grid">
        {menuItems.map((item) => (
          <button
            key={item.key}
            className="vet-menu-card"
            onClick={() => setActiveMenu(item.key)}
          >
            <span className="vet-menu-card-title">{item.title}</span>
            <span className="vet-menu-card-text">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}