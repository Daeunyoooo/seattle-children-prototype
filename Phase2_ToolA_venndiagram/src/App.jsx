import { useState, useEffect, useMemo } from 'react'
import TabNav from './components/TabNav.jsx'
import PerspectiveSwitcher from './components/PerspectiveSwitcher.jsx'
import VennDiagramPanel from './components/VennDiagramPanel.jsx'
import SharedValuesPanel from './components/SharedValuesPanel.jsx'
import StakeholderValuesPanel from './components/StakeholderValuesPanel.jsx'
import styles from './App.module.css'

export const STAKEHOLDERS = {
  youth:     { key: 'youth',     label: 'Youth',     color: '#F59E0B', light: '#FEF3C7', mid: '#FDE68A' },
  caregiver: { key: 'caregiver', label: 'Caregiver', color: '#C2410C', light: '#FFF4EC', mid: '#FDCBA0' },
  clinician: { key: 'clinician', label: 'Clinician', color: '#2563EB', light: '#DBEAFE', mid: '#BFDBFE' },
}

const TABS = ['Value Alignment Map', 'Our Shared Values', 'Youth\'s Values', 'Caregiver\'s Values', 'Clinician\'s Values']
const STAKEHOLDER_TABS = { youth: 2, caregiver: 3, clinician: 4 }

const DELETED_IDS_KEY = 'kidscolab.deletedValueIds.v1'

function normalizeYouthValues(youthValues = []) {
  return youthValues
    .map((value, index) => {
      const label = String(value.label || value.text || '').trim()
      if (!label) return null
      return {
        id: value.id || `phase2-youth-${index}`,
        emoji: value.emoji || '⭐',
        label,
        description: value.description || label,
      }
    })
    .filter(Boolean)
}

function loadDeletedIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DELETED_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []
  } catch {
    return []
  }
}

export default function App({ youthValues = [] }) {
  const [activeTab, setActiveTab]           = useState(0)
  const [perspective, setPerspective]       = useState('youth')
  const [selectedRegion, setSelectedRegion] = useState(null)
  const [deletedIds, setDeletedIds]         = useState(loadDeletedIds)
  const selectedYouthValues = useMemo(() => normalizeYouthValues(youthValues), [youthValues])

  // Persist deletedIds to localStorage whenever they change
  useEffect(() => {
    try {
      window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify(deletedIds))
    } catch {}
  }, [deletedIds])

  function handleDeleteValue(id) {
    setDeletedIds(prev => prev.includes(id) ? prev : [...prev, id])
  }

  function handleRestoreAll() {
    if (!window.confirm('Restore all deleted values?')) return
    setDeletedIds([])
    try {
      window.localStorage.removeItem(DELETED_IDS_KEY)
    } catch {}
  }

  function handleRegionClick(region) {
    setSelectedRegion(region)
    if (region === 'youth')     { setActiveTab(2); return }
    if (region === 'caregiver') { setActiveTab(3); return }
    if (region === 'clinician') { setActiveTab(4); return }
    setActiveTab(1)
  }

  function handleTabChange(idx) {
    setActiveTab(idx)
    if (idx !== 1) setSelectedRegion(null)
  }

  const myTab = STAKEHOLDER_TABS[perspective]

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.titleBlock}>
            <span className={styles.badge}>CKD Care</span>
            <h1 className={styles.title}>Value Alignment Map</h1>
            <p className={styles.subtitle}>Visualizing shared and individual values across care stakeholders</p>
          </div>
          <PerspectiveSwitcher perspective={perspective} onChange={setPerspective} myTab={myTab} />
        </div>
      </header>

      <main className={styles.main}>
        <TabNav
          tabs={TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
          perspective={perspective}
        />

        <div className={styles.panel}>
          {activeTab === 0 && (
            <VennDiagramPanel
              onRegionClick={handleRegionClick}
              perspective={perspective}
              deletedIds={deletedIds}
              onRestoreAll={handleRestoreAll}
              youthValues={selectedYouthValues}
            />
          )}
          {activeTab === 1 && (
            <SharedValuesPanel
              selectedRegion={selectedRegion}
              setSelectedRegion={setSelectedRegion}
              perspective={perspective}
              deletedIds={deletedIds}
              onDeleteValue={handleDeleteValue}
              onRestoreAll={handleRestoreAll}
            />
          )}
          {activeTab === 2 && (
            <StakeholderValuesPanel
              stakeholder="youth"
              perspective={perspective}
              deletedIds={deletedIds}
              onDeleteValue={handleDeleteValue}
              onRestoreAll={handleRestoreAll}
              youthValues={selectedYouthValues}
            />
          )}
          {activeTab === 3 && (
            <StakeholderValuesPanel
              stakeholder="caregiver"
              perspective={perspective}
              deletedIds={deletedIds}
              onDeleteValue={handleDeleteValue}
              onRestoreAll={handleRestoreAll}
            />
          )}
          {activeTab === 4 && (
            <StakeholderValuesPanel
              stakeholder="clinician"
              perspective={perspective}
              deletedIds={deletedIds}
              onDeleteValue={handleDeleteValue}
              onRestoreAll={handleRestoreAll}
            />
          )}
        </div>
      </main>
    </div>
  )
}
