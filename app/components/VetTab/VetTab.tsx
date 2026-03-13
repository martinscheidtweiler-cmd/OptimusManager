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

type VetGroup = {
  title: string
  text: string
  items: {
    key: VetMenu
    label: string
    text: string
  }[]
}

const menuGroups: VetGroup[] = [
  {
    title: 'Diagnostics',
    text: 'Scans, imaging and lab follow-up.',
    items: [
      { key: 'Xray', label: 'Xray', text: 'X-ray scans and imaging' },
      { key: 'Lab Results', label: 'Lab Results', text: 'Blood tests and lab results' },
    ],
  },
  {
    title: 'Care & Treatments',
    text: 'Daily veterinary care and medicine follow-up.',
    items: [
      { key: 'Vet Visits', label: 'Vet Visits', text: 'Vet visits and follow-up' },
      { key: 'Treatments', label: 'Treatments', text: 'Treatments and medication' },
      { key: 'Medicines', label: 'Medicines', text: 'Medicine register' },
    ],
  },
  {
    title: 'Prevention',
    text: 'Preventive health planning and stock follow-up.',
    items: [
      { key: 'Vaccinations', label: 'Vaccinations', text: 'Vaccines and planning' },
      { key: 'Deworming', label: 'Deworming', text: 'Deworming and schedule' },
    ],
  },
  {
    title: 'Breeding',
    text: 'Mare monitoring, foals and births.',
    items: [
      { key: 'Mares', label: 'Mares', text: 'Mare monitoring' },
      { key: 'Births', label: 'Births', text: 'Foals and births' },
    ],
  },
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
      <p className="vet-intro">
        Clear overview of diagnostics, treatments, prevention and breeding follow-up.
      </p>

      <div className="vet-group-list">
        {menuGroups.map((group) => (
          <section key={group.title} className="vet-group-card">
            <div className="vet-group-head">
              <h3 className="vet-group-title">{group.title}</h3>
              <p className="vet-group-text">{group.text}</p>
            </div>

            <div className="vet-submenu-grid">
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className="vet-submenu-card"
                  onClick={() => setActiveMenu(item.key)}
                  type="button"
                >
                  <span className="vet-submenu-card-title">{item.label}</span>
                  <span className="vet-submenu-card-text">{item.text}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}