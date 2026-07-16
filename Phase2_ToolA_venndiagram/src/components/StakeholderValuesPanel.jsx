import youthData     from '../data/youth.json'
import caregiverData from '../data/caregiver.json'
import clinicianData from '../data/clinician.json'
import sharedValues  from '../data/sharedValues.json'
import styles from './StakeholderValuesPanel.module.css'

const STAKEHOLDER_DATA = { youth: youthData, caregiver: caregiverData, clinician: clinicianData }

const CONFIG = {
  youth:     { label: 'Youth',     color: '#F59E0B', light: '#FEF3C7', mid: '#FDE68A' },
  caregiver: { label: 'Caregiver', color: '#C2410C', light: '#FFF4EC', mid: '#FDCBA0' },
  clinician: { label: 'Clinician', color: '#2563EB', light: '#DBEAFE', mid: '#BFDBFE' },
}

function isValueShared(valueId) {
  return Object.values(sharedValues).flat().some(sv => sv.relatedValues?.includes(valueId))
}

export default function StakeholderValuesPanel({
  stakeholder,
  perspective,
  deletedIds = [],
  onDeleteValue = () => {},
  onRestoreAll = () => {},
  youthValues = [],
}) {
  const { label, color, light, mid } = CONFIG[stakeholder]
  const defaultData = STAKEHOLDER_DATA[stakeholder]
  const vals = stakeholder === 'youth' ? youthValues : defaultData.values
  const goal = defaultData.goal
  const isMe = stakeholder === perspective

  const deletedSet = new Set(deletedIds)
  const visibleVals = vals.filter(v => !deletedSet.has(v.id))
  const hiddenCount = vals.length - visibleVals.length

  function handleDelete(e, valueId, valueLabel) {
    e.stopPropagation()
    if (window.confirm(`Remove "${valueLabel}" from ${label}'s values?`)) {
      onDeleteValue(valueId)
    }
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header} style={{ background: `linear-gradient(135deg, ${light} 0%, #ffffff 100%)` }}>
        <div className={styles.headerTop}>
          <div className={styles.avatarRing} style={{ borderColor: color, background: mid }}>
            <span className={styles.avatarLetter} style={{ color }}>{label[0]}</span>
          </div>
          <div>
            <div className={styles.roleLabel} style={{ color }}>
              {isMe ? '👤 My Values' : `${label}'s Values`}
            </div>
            <h2 className={styles.name}>{label}</h2>
          </div>
        </div>

        {/* Goal box */}
        <div className={styles.goalBox} style={{ borderColor: color, background: mid + 'aa' }}>
          <div className={styles.goalIcon}>🎯</div>
          <div>
            <div className={styles.goalBoxLabel} style={{ color }}>
              {isMe ? 'My Goal' : `${label}'s Goal`}
            </div>
            <div className={styles.goalBoxText}>{goal}</div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle} style={{ color }}>
            {isMe ? 'What I Care About' : `What ${label}s Care About`}
          </h3>
          <span className={styles.count} style={{ background: light, color }}>
            {visibleVals.length} {visibleVals.length === 1 ? 'value' : 'values'}
          </span>
          {hiddenCount > 0 && (
            <button className={styles.restoreBtn} onClick={onRestoreAll} title="Restore all deleted values">
              ↺ Restore {hiddenCount} hidden
            </button>
          )}
        </div>

        {visibleVals.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🍃</div>
            <div className={styles.emptyText}>All values have been removed.</div>
            <button className={styles.emptyRestore} onClick={onRestoreAll}>
              ↺ Restore deleted values
            </button>
          </div>
        ) : (
          <div className={styles.valueGrid}>
            {visibleVals.map((v) => {
              const shared = isValueShared(v.id)
              return (
                <div
                  key={v.id}
                  className={`${styles.valueCard} ${shared ? styles.valueCardShared : ''}`}
                  style={shared
                    ? { borderColor: color, background: light }
                    : { borderColor: '#f3f4f6' }
                  }
                >
                  {shared && (
                    <div className={styles.sharedBadge} style={{ color, background: mid }}>
                      ✨ shared
                    </div>
                  )}
                  <button
                    className={styles.deleteCardBtn}
                    onClick={(e) => handleDelete(e, v.id, v.label)}
                    title="Remove this value"
                    aria-label={`Remove ${v.label}`}
                  >
                    ×
                  </button>
                  <div className={styles.valueEmoji}>{v.emoji}</div>
                  <div className={styles.valueLabel}>{v.label}</div>
                  <div className={styles.valueDesc}>{v.description}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
