'use client'

import { useState } from 'react'
import styles from './VetTab.module.css'
import XraysTab from './XraysTab'
import LabResultsTab from './LabResultsTab'
import VetVisitsTab from './VetVisitsTab'
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

  if (activeMenu === 'Xray') {
    return <XraysTab onBack={() => setActiveMenu(null)} />
  }

  if (activeMenu === 'Lab Results') {
    return <LabResultsTab onBack={() => setActiveMenu(null)} />
  }

  if (activeMenu === 'Vet Visits') {
    return <VetVisitsTab onBack={() => setActiveMenu(null)} />
  }

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
    <div className={styles.omPlainContent}>
      <span className={styles.omKicker}>Health Management</span>
      <h2 className={styles.omTitle}>Vet</h2>

      <p className={styles.vetIntro}>
        Clear overview of diagnostics, treatments, prevention and breeding follow-up.
      </p>

      <div className={styles.vetGroupList}>
        {menuGroups.map((group) => (
          <section key={group.title} className={styles.vetGroupCard}>
            <div className={styles.vetGroupHead}>
              <h3 className={styles.vetGroupTitle}>{group.title}</h3>
              <p className={styles.vetGroupText}>{group.text}</p>
            </div>

            <div className={styles.vetSubmenuGrid}>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={styles.vetSubmenuCard}
                  onClick={() => setActiveMenu(item.key)}
                >
                  <span className={styles.vetSubmenuCardTitle}>
                    {item.label}
                  </span>

                  <span className={styles.vetSubmenuCardText}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}