import { STAKEHOLDERS } from '../App.jsx'
import styles from './PerspectiveSwitcher.module.css'

export default function PerspectiveSwitcher({ perspective, onChange }) {
  return (
    <div className={styles.container}>
      <span className={styles.label}>Viewing as:</span>
      <div className={styles.group}>
        {Object.values(STAKEHOLDERS).map(({ key, label, color, light, mid }) => {
          const isActive = perspective === key
          return (
            <button
              key={key}
              className={`${styles.btn} ${isActive ? styles.active : ''}`}
              style={isActive
                ? { background: mid, color: '#111827', borderColor: color, boxShadow: `0 0 0 3px ${light}` }
                : { borderColor: '#e5e7eb' }
              }
              onClick={() => onChange(key)}
            >
              <span
                className={styles.swatch}
                style={{ background: isActive ? color : mid, border: `2px solid ${color}` }}
              />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
