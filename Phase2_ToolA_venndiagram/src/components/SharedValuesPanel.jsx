import sharedValues from '../data/sharedValues.json'
import styles from './SharedValuesPanel.module.css'

const COLORS = {
  youth:     { fill: '#FDE68A', stroke: '#F59E0B' },
  caregiver: { fill: '#FDCBA0', stroke: '#C2410C' },
  clinician: { fill: '#BFDBFE', stroke: '#2563EB' },
}

const REGION_CONFIG = [
  {
    key: 'all',
    label: 'All Three',
    emoji: '🌟',
    participants: ['youth', 'caregiver', 'clinician'],
    accent: '#7c3aed',
    accentLight: '#f5f3ff',
  },
  {
    key: 'youth_caregiver',
    label: 'Youth + Caregiver',
    emoji: '💛',
    participants: ['youth', 'caregiver'],
    accent: '#d97706',
    accentLight: '#fffbeb',
  },
  {
    key: 'youth_clinician',
    label: 'Youth + Clinician',
    emoji: '💚',
    participants: ['youth', 'clinician'],
    accent: '#059669',
    accentLight: '#ecfdf5',
  },
  {
    key: 'caregiver_clinician',
    label: 'Caregiver + Clinician',
    emoji: '💜',
    participants: ['caregiver', 'clinician'],
    accent: '#db2777',
    accentLight: '#fdf2f8',
  },
]

export default function SharedValuesPanel({
  selectedRegion,
  setSelectedRegion,
  deletedIds = [],
  onDeleteValue = () => {},
  onRestoreAll = () => {},
}) {
  // Only surface regions that actually have shared values in the data
  const availableRegions = REGION_CONFIG.filter(r => (sharedValues[r.key] || []).length > 0)

  const activeRegions = selectedRegion
    ? availableRegions.filter(r => r.key === selectedRegion)
    : availableRegions

  const deletedSet = new Set(deletedIds)

  // Count hidden across all regions for the restore prompt
  const totalHidden = Object.values(sharedValues).flat().filter(v => deletedSet.has(v.id)).length

  function handleDelete(e, valueId, valueLabel) {
    e.stopPropagation()
    if (window.confirm(`Remove the shared value "${valueLabel}"?`)) {
      onDeleteValue(valueId)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h2 className={styles.panelTitle}>🤝 Our Shared Values</h2>
          <p className={styles.panelSubtitle}>Things we all care about together</p>
        </div>
        <div className={styles.topActions}>
          {totalHidden > 0 && (
            <button className={styles.restoreBtn} onClick={onRestoreAll} title="Restore all deleted values">
              ↺ Restore {totalHidden} hidden
            </button>
          )}
          {selectedRegion && (
            <button className={styles.clearBtn} onClick={() => setSelectedRegion(null)}>
              ← Show all
            </button>
          )}
        </div>
      </div>

      {/* Region filter pills */}
      <div className={styles.filterRow}>
        <button
          className={`${styles.filterPill} ${!selectedRegion ? styles.filterActive : ''}`}
          onClick={() => setSelectedRegion(null)}
        >
          All groups
        </button>
        {availableRegions.map(r => (
          <button
            key={r.key}
            className={`${styles.filterPill} ${selectedRegion === r.key ? styles.filterActive : ''}`}
            style={selectedRegion === r.key
              ? { background: r.accentLight, borderColor: r.accent, color: r.accent }
              : {}
            }
            onClick={() => setSelectedRegion(selectedRegion === r.key ? null : r.key)}
          >
            {r.emoji} {r.label}
          </button>
        ))}
      </div>

      <div className={styles.sections}>
        {activeRegions.map(region => {
          const regionVals = (sharedValues[region.key] || []).filter(v => !deletedSet.has(v.id))
          return (
            <section key={region.key} className={styles.section}>
              {/* Section header */}
              <div
                className={styles.sectionHeader}
                style={{ background: region.accentLight, borderColor: region.accent }}
              >
                <div className={styles.sectionEmoji}>{region.emoji}</div>
                <div>
                  <h3 className={styles.sectionTitle} style={{ color: region.accent }}>
                    {region.label}
                  </h3>
                  <div className={styles.sectionChips}>
                    {region.participants.map(p => (
                      <span
                        key={p}
                        className={styles.chip}
                        style={{ background: COLORS[p].fill, border: `1.5px solid ${COLORS[p].stroke}` }}
                      >
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Value cards grid */}
              {regionVals.length === 0 ? (
                <div className={styles.emptyRegion}>
                  No remaining shared values in this region.
                </div>
              ) : (
                <div className={styles.valueGrid}>
                  {regionVals.map((val) => (
                    <div
                      key={val.id}
                      className={styles.valueCard}
                      style={{ borderColor: region.accent + '55' }}
                    >
                      <button
                        className={styles.deleteCardBtn}
                        onClick={(e) => handleDelete(e, val.id, val.label)}
                        title="Remove this shared value"
                        aria-label={`Remove ${val.label}`}
                      >
                        ×
                      </button>
                      <div className={styles.valueEmoji}>{val.emoji}</div>
                      <div className={styles.valueLabel}>{val.label}</div>
                      <div className={styles.valueDesc}>{val.description}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
