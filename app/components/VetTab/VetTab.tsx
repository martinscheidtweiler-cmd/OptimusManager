'use client'

import { useState } from 'react'
import './VetTab.css'
import MedicinesTab from './MedicinesTab'
import VaccinationsTab from './VaccinationsTab'
import DewormingTab from './DewormingTab'

type VetMenu =
  | 'Xray'
  | 'Lab Results'
  | 'Vet Visits'
  | 'Treatments'
  | 'Vaccinations'
  | 'Deworming'
  | 'Mares'
  | 'Births'
  | 'Medicines'

const menuItems: {
  key: VetMenu
  title: string
  text: string
}[] = [
  { key: 'Xray', title: 'Xray', text: 'X-ray scans and imaging' },
  { key: 'Lab Results', title: 'Lab Results', text: 'Blood tests and lab results' },
  { key: 'Vet Visits', title: 'Vet Visits', text: 'Vet visits and follow-up' },
  { key: 'Treatments', title: 'Treatments', text: 'Treatments and medication' },
  { key: 'Vaccinations', title: 'Vaccinations', text: 'Vaccines and planning' },
  { key: 'Deworming', title: 'Deworming', text: 'Deworming and schedule' },
  { key: 'Medicines', title: 'Medicines', text: 'Medicine register' },
  { key: 'Mares', title: 'Mares', text: 'Mare monitoring' },
  { key: 'Births', title: 'Births', text: 'Foals and births' },
]

export default function VetTab() {
  const [activeMenu, setActiveMenu] = useState<VetMenu | null>(null)

  if (activeMenu === 'Vaccinations') {
    return <VaccinationsTab onBack={() => setActiveMenu(null)} />
  }

  if (activeMenu === 'Deworming') {
    return <DewormingTab onBack={() => setActiveMenu(null)} />
  }

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
            type="button"
          >
            <span className="vet-menu-card-title">{item.title}</span>
            <span className="vet-menu-card-text">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}