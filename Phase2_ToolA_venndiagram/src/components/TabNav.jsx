import { STAKEHOLDERS } from '../App.jsx'
import styles from './TabNav.module.css'

const BASE_LABELS = [
  'Value Alignment Map',
  'Our Shared Values',
  "Youth's Values",
  "Caregiver's Values",
  "Clinician's Values",
]

const PERSPECTIVE_TAB = { youth: 2, caregiver: 3, clinician: 4 }

export default function TabNav({ activeTab, onChange, perspective }) {
  const myTabIdx = PERSPECTIVE_TAB[perspective]
  const { color, mid } = STAKEHOLDERS[perspective]

  return (
    <nav className={styles.nav}>
      {BASE_LABELS.map((label, i) => {
        const isActive = activeTab === i
        const isMyTab  = i === myTabIdx
        const displayLabel = isMyTab
          ? `My Values (${STAKEHOLDERS[perspective].label})`
          : label

        return (
          <button
            key={i}
            className={`${styles.tab} ${isActive ? styles.active : ''} ${isMyTab ? styles.myTab : ''}`}
            style={isActive && isMyTab ? { borderBottomColor: color, color } : isMyTab ? { color } : {}}
            onClick={() => onChange(i)}
            aria-selected={isActive}
          >
            {isMyTab && (
              <span className={styles.dot} style={{ background: mid, border: `2px solid ${color}` }} />
            )}
            {displayLabel}
          </button>
        )
      })}
    </nav>
  )
}
