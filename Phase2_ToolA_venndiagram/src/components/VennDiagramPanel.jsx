import { useState, useRef, useEffect, useMemo } from 'react'
import youthData     from '../data/youth.json'
import caregiverData from '../data/caregiver.json'
import clinicianData from '../data/clinician.json'
import sharedValues  from '../data/sharedValues.json'
import styles from './VennDiagramPanel.module.css'

const goals = {
  youth:     youthData.goal,
  caregiver: caregiverData.goal,
  clinician: clinicianData.goal,
}

// Circle geometry (SVG viewBox: 0 0 480 420)
const R = 118
const CIRCLES = {
  youth:     { cx: 170, cy: 165 },
  caregiver: { cx: 310, cy: 165 },
  clinician: { cx: 240, cy: 262 },
}

const COLORS = {
  youth:     { fill: '#FDE68A', stroke: '#F59E0B' },
  caregiver: { fill: '#FDCBA0', stroke: '#C2410C' },
  clinician: { fill: '#BFDBFE', stroke: '#2563EB' },
}

// Look up which stakeholder owns each value id and what THEY call it.
const VALUE_INFO = {}
;[['youth', youthData], ['caregiver', caregiverData], ['clinician', clinicianData]]
  .forEach(([stakeholder, data]) => {
    data.values.forEach(v => { VALUE_INFO[v.id] = { stakeholder, label: v.label } })
  })

// Build the label line(s) for a dot. A shared dot whose owners use DIFFERENT
// names renders one stakeholder-colored line per name; everything else renders
// a single neutral line (so identically-named shared values stay compact).
function getDotLabelLines(dot, valueInfo = VALUE_INFO) {
  const ids = dot.valueIds || [dot.id]
  if (ids.length <= 1) return [{ text: dot.short, color: '#111827' }]
  const seen = new Map()
  ids.forEach(id => {
    const info = valueInfo[id]
    if (info && !seen.has(info.label)) seen.set(info.label, COLORS[info.stakeholder].stroke)
  })
  const entries = [...seen.entries()]
  if (entries.length <= 1) return [{ text: dot.short, color: '#111827' }]
  return entries.map(([text, color]) => ({ text, color }))
}

const LABELS = {
  youth:     { x: 170, y: 38, align: 'middle' },
  caregiver: { x: 310, y: 38, align: 'middle' },
  clinician: { x: 240, y: 410, align: 'middle' },
}

// Initial dot positions per region — these can be moved/edited by the user.
// Every dot maps to a real current value id, shown with its full value name.
// A dot may represent the SAME value held by several stakeholders (valueIds);
// such shared values sit in the overlap regions and disappear if ANY owner
// deletes their copy.
const REGION_VALUE_DOTS = {
  youth: [
    { id: 'y1', x: 95,  y: 118, short: 'Hang out with friends' },
    { id: 'y6', x: 80,  y: 152, short: 'Enjoy my favorite foods' },
    { id: 'y5', x: 95,  y: 186, short: 'Feel like a regular kid' },
    { id: 'y3', x: 100, y: 220, short: 'Play sports & games' },
  ],
  caregiver: [
    { id: 'c4', x: 388, y: 165, short: 'Preventing Infections' },
  ],
  clinician: [
    { id: 'cl1', x: 208, y: 315, short: 'Preventing harm' },
    { id: 'cl3', x: 278, y: 340, short: 'Blood Pressure Control' },
  ],
  youth_caregiver: [
    // Youth "Life Participation" + Caregiver "Life Participation"
    { id: 'c1', x: 240, y: 125, short: 'Life Participation', valueIds: ['y4', 'c1'] },
  ],
  youth_clinician: [
    // Youth "Feel heard in care" + Clinician "What matters to you"
    { id: 'y2', x: 160, y: 232, short: "What matters to you", valueIds: ['y2', 'cl5'] },
  ],
  caregiver_clinician: [
    // Caregiver "Survival" + Clinician "Promoting long-term survival"
    { id: 'c2', x: 320, y: 235, short: 'Survival', valueIds: ['c2', 'cl4'] },
  ],
  all: [
    // Kidney Health is held by all three stakeholders
    { id: 'c3', x: 240, y: 198, short: 'Kidney Health', valueIds: ['y7', 'c3', 'cl2'] },
  ],
}

// Flatten into a single list with region attached.
const INITIAL_DOTS = Object.entries(REGION_VALUE_DOTS).flatMap(
  ([region, dots]) => dots.map(d => ({ ...d, region }))
)

function makeYouthDots(youthValues = []) {
  return youthValues.map((value, index) => ({
    id: value.id || `phase2-youth-${index}`,
    x: 82 + (index % 2) * 44,
    y: 112 + Math.floor(index / 2) * 34,
    short: value.label,
    region: 'youth',
  }))
}

function makeDotsForYouthValues(youthValues = []) {
  const nonYouthDots = INITIAL_DOTS.filter(dot => {
    const ids = dot.valueIds || [dot.id]
    return dot.region !== 'youth' && !ids.some(id => String(id).startsWith('y'))
  })
  return [...makeYouthDots(youthValues), ...nonYouthDots]
}

function makeValueInfoForYouthValues(youthValues = []) {
  const info = { ...VALUE_INFO }
  Object.keys(info).forEach(id => {
    if (String(id).startsWith('y')) delete info[id]
  })
  youthValues.forEach((value, index) => {
    const id = value.id || `phase2-youth-${index}`
    info[id] = { stakeholder: 'youth', label: value.label }
  })
  return info
}

const STORAGE_KEY = 'kidscolab.vennDots.v6'

function loadDotsFromStorage() {
  if (typeof window === 'undefined') return INITIAL_DOTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_DOTS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_DOTS
    // Basic shape validation — every dot needs id, x, y, short, region
    const valid = parsed.every(d =>
      d && typeof d.id === 'string'
        && typeof d.x === 'number'
        && typeof d.y === 'number'
        && typeof d.short === 'string'
        && typeof d.region === 'string'
    )
    return valid ? parsed : INITIAL_DOTS
  } catch {
    return INITIAL_DOTS
  }
}

// Center of each region for the hover-ring indicator
const REGION_DOT_CENTERS = {
  youth:               { x: 100, y: 155 },
  caregiver:           { x: 380, y: 155 },
  clinician:           { x: 240, y: 312 },
  youth_caregiver:     { x: 240, y: 105 },
  youth_clinician:     { x: 162, y: 233 },
  caregiver_clinician: { x: 319, y: 233 },
  all:                 { x: 236, y: 200 },
}

const REGION_META = {
  youth:               { label: 'Youth only',           participants: ['youth'] },
  caregiver:           { label: 'Caregiver only',        participants: ['caregiver'] },
  clinician:           { label: 'Clinician only',        participants: ['clinician'] },
  youth_caregiver:     { label: 'Youth + Caregiver',     participants: ['youth', 'caregiver'] },
  youth_clinician:     { label: 'Youth + Clinician',     participants: ['youth', 'clinician'] },
  caregiver_clinician: { label: 'Caregiver + Clinician', participants: ['caregiver', 'clinician'] },
  all:                 { label: 'All three share',       participants: ['youth', 'caregiver', 'clinician'] },
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2)
}

function getRegion(x, y) {
  const inY  = dist(x, y, CIRCLES.youth.cx,     CIRCLES.youth.cy)     <= R
  const inC  = dist(x, y, CIRCLES.caregiver.cx, CIRCLES.caregiver.cy) <= R
  const inCl = dist(x, y, CIRCLES.clinician.cx, CIRCLES.clinician.cy) <= R
  if (inY && inC && inCl) return 'all'
  if (inY && inC)         return 'youth_caregiver'
  if (inY && inCl)        return 'youth_clinician'
  if (inC && inCl)        return 'caregiver_clinician'
  if (inY)                return 'youth'
  if (inC)                return 'caregiver'
  if (inCl)               return 'clinician'
  return null
}

function circleOpacity(circle, region) {
  if (!region) return 0.55
  const { participants } = REGION_META[region]
  return participants.includes(circle) ? 0.72 : 0.18
}

function getRegionValues(region) {
  if (!region || ['youth', 'caregiver', 'clinician'].includes(region)) return []
  return sharedValues[region] || []
}

function dotColor(region) {
  const participants = REGION_META[region]?.participants || []
  if (participants.length === 1) return COLORS[participants[0]].stroke
  if (participants.length === 3) return '#7c3aed'
  return '#6b7280'
}

// Compute label position and anchor for a dot based on its location in the SVG
function getLabelProps(dot) {
  if (dot.x < 210) return { anchor: 'start',  tx: dot.x + 10, ty: dot.y + 3.5 }
  if (dot.x > 270) return { anchor: 'end',    tx: dot.x - 10, ty: dot.y + 3.5 }
  if (dot.y > 280) return { anchor: 'middle', tx: dot.x,      ty: dot.y + 16  }
  return                   { anchor: 'middle', tx: dot.x,      ty: dot.y - 9   }
}

export default function VennDiagramPanel({ onRegionClick, deletedIds = [], onRestoreAll = () => {}, youthValues = [] }) {
  const initialDots = useMemo(() => makeDotsForYouthValues(youthValues), [youthValues])
  const valueInfo = useMemo(() => makeValueInfoForYouthValues(youthValues), [youthValues])
  const [hoveredRegion, setHoveredRegion] = useState(null)
  const [dots, setDots]                   = useState(initialDots)
  const [draggingDot, setDraggingDot]     = useState(null) // { id, offsetX, offsetY }
  const [hoveredDotId, setHoveredDotId]   = useState(null)
  const svgRef        = useRef(null)
  const dragMovedRef  = useRef(false)

  useEffect(() => {
    setDots(initialDots)
  }, [initialDots])

  // Persist dots to localStorage whenever they change
  useEffect(() => {
    if (youthValues.length > 0) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dots))
    } catch {
      // ignore quota / privacy mode errors — in-memory state still works
    }
  }, [dots, youthValues.length])

  function getSvgCoords(e) {
    const svg  = svgRef.current
    const rect = svg.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (480 / rect.width),
      y: (e.clientY - rect.top)  * (420 / rect.height),
    }
  }

  function handleDotMouseDown(e, dot) {
    e.stopPropagation()
    e.preventDefault()
    const { x, y } = getSvgCoords(e)
    setDraggingDot({ id: dot.id, offsetX: x - dot.x, offsetY: y - dot.y })
    dragMovedRef.current = false
  }

  function handleMouseMove(e) {
    const { x, y } = getSvgCoords(e)
    if (draggingDot) {
      const newX = x - draggingDot.offsetX
      const newY = y - draggingDot.offsetY
      const region = getRegion(newX, newY)
      dragMovedRef.current = true
      setDots(prev => prev.map(d =>
        d.id === draggingDot.id
          ? { ...d, x: newX, y: newY, region: region || d.region }
          : d
      ))
      if (region) setHoveredRegion(region)
    } else {
      setHoveredRegion(getRegion(x, y))
    }
  }

  function handleClick(e) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false
      return
    }
    const { x, y } = getSvgCoords(e)
    const region    = getRegion(x, y)
    if (region) onRegionClick(region)
  }

  function handleMouseLeave() {
    if (!draggingDot) setHoveredRegion(null)
    setHoveredDotId(null)
  }

  // Listen on document mouseup so dragging ends even if cursor leaves SVG
  useEffect(() => {
    if (!draggingDot) return
    function onUp() {
      setDraggingDot(null)
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [draggingDot])

  function handleEditDot(dot) {
    const newLabel = window.prompt('Edit value label:', dot.short)
    if (newLabel !== null && newLabel.trim()) {
      setDots(prev => prev.map(d =>
        d.id === dot.id ? { ...d, short: newLabel.trim() } : d
      ))
    }
  }

  function handleResetDots() {
    if (!window.confirm('Reset all dots to their original positions and labels? This cannot be undone.')) return
    setDots(initialDots)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  // Filter out dots whose values have been deleted on the detail pages.
  // A shared dot (valueIds) disappears as soon as ANY of its owners deletes it.
  const deletedSet = new Set(deletedIds)
  const visibleDots = dots.filter(d => {
    const ids = d.valueIds || [d.id]
    return !ids.some(id => deletedSet.has(id))
  })
  const hiddenCount = dots.length - visibleDots.length

  const previewValues = getRegionValues(hoveredRegion)

  return (
    <div className={styles.container}>
      <div className={styles.diagramWrap}>
        {/* Edit-mode helper bar */}
        <div className={styles.editHint}>
          <span>✏️ Drag dots to reorganize • double-click to rename. Delete values from their detail pages.</span>
          <div className={styles.editHintActions}>
            {hiddenCount > 0 && (
              <button className={styles.resetBtn} onClick={onRestoreAll} title="Restore deleted values">
                ↺ Restore {hiddenCount}
              </button>
            )}
            <button className={styles.resetBtn} onClick={handleResetDots} title="Reset dot positions">
              ↺ Reset
            </button>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 480 420"
          className={styles.svg}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: draggingDot ? 'grabbing' : (hoveredRegion ? 'pointer' : 'default') }}
        >
          {/* Circle fills */}
          {Object.entries(CIRCLES).map(([key, { cx, cy }]) => (
            <circle
              key={key}
              cx={cx} cy={cy} r={R}
              fill={COLORS[key].fill}
              opacity={circleOpacity(key, hoveredRegion)}
              style={{ transition: 'opacity 0.2s', mixBlendMode: 'multiply' }}
              pointerEvents="none"
            />
          ))}

          {/* Circle strokes */}
          {Object.entries(CIRCLES).map(([key, { cx, cy }]) => (
            <circle
              key={`stroke-${key}`}
              cx={cx} cy={cy} r={R}
              fill="none"
              stroke={COLORS[key].stroke}
              strokeWidth={hoveredRegion && REGION_META[hoveredRegion]?.participants.includes(key) ? 2.5 : 1.5}
              opacity={circleOpacity(key, hoveredRegion)}
              style={{ transition: 'opacity 0.2s, stroke-width 0.15s' }}
              pointerEvents="none"
            />
          ))}

          {/* Stakeholder name labels */}
          {[['youth', 'Youth'], ['caregiver', 'Caregiver'], ['clinician', 'Clinician']].map(([key, name]) => (
            <text
              key={`lbl-${key}`}
              x={LABELS[key].x} y={LABELS[key].y}
              textAnchor={LABELS[key].align}
              className={styles.circleLabel}
              opacity={circleOpacity(key, hoveredRegion)}
              style={{ transition: 'opacity 0.2s' }}
              pointerEvents="none"
            >
              {name}
            </text>
          ))}

          {/* Hover ring at region center */}
          {hoveredRegion && !draggingDot && (
            <circle
              cx={REGION_DOT_CENTERS[hoveredRegion].x}
              cy={REGION_DOT_CENTERS[hoveredRegion].y}
              r={24}
              fill="none"
              stroke="#374151"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.4}
              pointerEvents="none"
            />
          )}

          {/* Invisible background overlay — catches region hover/click between dots */}
          <rect x={0} y={0} width={480} height={420} fill="transparent" />

          {/* Draggable / editable value dots — rendered LAST so they're on top */}
          {visibleDots.map(dot => {
            const isRegionActive = hoveredRegion === dot.region
            const isHovered      = hoveredDotId === dot.id
            const isDragging     = draggingDot?.id === dot.id
            const dotOpacity = hoveredRegion
              ? (isRegionActive || isHovered || isDragging ? 0.95 : 0.22)
              : 0.65
            const showLabel = isRegionActive || isHovered || isDragging
            const { anchor, tx, ty } = getLabelProps(dot)
            const labelLines = showLabel ? getDotLabelLines(dot, valueInfo) : []
            const lineH = 12.5
            const estW = Math.max(0, ...labelLines.map(l => l.text.length * 5.4)) + 12
            const bgX  = anchor === 'start'  ? tx - 4
                       : anchor === 'end'    ? tx - estW + 4
                       : tx - estW / 2
            // When the label sits above the dot, grow multi-line blocks upward
            // so extra lines don't cover the dot.
            const labelAbove = ty < dot.y - 2
            const firstTy = labelAbove ? ty - (labelLines.length - 1) * lineH : ty
            const r = isDragging ? 7 : (isHovered ? 6.5 : (isRegionActive ? 5.5 : 4.5))

            return (
              <g key={dot.id}>
                {/* Dot fill */}
                <circle
                  cx={dot.x} cy={dot.y} r={r}
                  fill={dotColor(dot.region)}
                  opacity={dotOpacity}
                  stroke={isDragging || isHovered ? '#ffffff' : 'none'}
                  strokeWidth={isDragging || isHovered ? 1.6 : 0}
                  style={{
                    transition: isDragging ? 'none' : 'opacity 0.18s, r 0.15s',
                    filter: isDragging ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))' : 'none',
                  }}
                  pointerEvents="none"
                />

                {/* Larger invisible hit area for easier grabbing */}
                <circle
                  cx={dot.x} cy={dot.y} r={13}
                  fill="transparent"
                  style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={(e) => handleDotMouseDown(e, dot)}
                  onMouseEnter={() => !draggingDot && setHoveredDotId(dot.id)}
                  onMouseLeave={() => setHoveredDotId(null)}
                  onDoubleClick={(e) => { e.stopPropagation(); handleEditDot(dot) }}
                />

                {/* Label */}
                {showLabel && (
                  <g pointerEvents="none">
                    <rect
                      x={bgX} y={firstTy - 10.5}
                      width={estW} height={labelLines.length * lineH + 3}
                      rx={3}
                      fill="white"
                      fillOpacity={0.93}
                    />
                    {labelLines.map((line, i) => (
                      <text
                        key={i}
                        x={tx} y={firstTy + i * lineH}
                        textAnchor={anchor}
                        fontSize={9.5}
                        fontFamily="Inter, -apple-system, sans-serif"
                        fontWeight="600"
                        fill={line.color}
                      >
                        {line.text}
                      </text>
                    ))}
                  </g>
                )}

              </g>
            )
          })}
        </svg>

        {/* Shared goal ribbon */}
        <div className={styles.goalRibbon}>
          <span className={styles.goalIcon}>🎯</span>
          <div>
            <div className={styles.goalLabel}>Shared Goal</div>
            <div className={styles.goalText}>Quality of life with CKD — medical stability and a joyful, connected childhood</div>
          </div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          {Object.entries(COLORS).map(([key, { fill, stroke }]) => (
            <div key={key} className={styles.legendItem}>
              <span className={styles.legendSwatch} style={{ background: fill, border: `2px solid ${stroke}` }} />
              <span className={styles.legendLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right side panel */}
      <div className={styles.sidePanel}>
        {!hoveredRegion ? (
          <div className={styles.hint}>
            <div className={styles.hintIcon}>👆</div>
            <h3 className={styles.hintTitle}>Explore the map</h3>
            <p className={styles.hintText}>Hover over any circle or overlap region to preview values. Click to dive in. Drag dots to reorganize, or open a value card on the detail pages to remove it.</p>
            <div className={styles.goalCards}>
              {Object.entries(goals).map(([key, goal]) => (
                <div
                  key={key}
                  className={styles.goalCard}
                  style={{ borderLeft: `4px solid ${COLORS[key].stroke}`, background: COLORS[key].fill + '55' }}
                >
                  <div className={styles.goalCardStakeholder}>{key.charAt(0).toUpperCase() + key.slice(1)}'s Goal</div>
                  <div className={styles.goalCardText}>{goal}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.preview}>
            <div className={styles.previewHeader}>
              <div className={styles.previewParticipants}>
                {REGION_META[hoveredRegion].participants.map(p => (
                  <span
                    key={p}
                    className={styles.participantChip}
                    style={{ background: COLORS[p].fill, border: `1.5px solid ${COLORS[p].stroke}` }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                ))}
              </div>
              <h3 className={styles.previewTitle}>{REGION_META[hoveredRegion].label}</h3>
            </div>

            {previewValues.length > 0 ? (
              <>
                <p className={styles.previewSubhead}>Shared values in this region:</p>
                <ul className={styles.previewList}>
                  {previewValues.map(v => (
                    <li key={v.id} className={styles.previewItem}>
                      <span className={styles.previewBullet} />
                      <div>
                        <div className={styles.previewItemLabel}>{v.label}</div>
                        <div className={styles.previewItemDesc}>{v.description}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : REGION_META[hoveredRegion].participants.length === 1 ? (
              <>
                <p className={styles.previewSubhead}>Individual goal:</p>
                <div
                  className={styles.goalCard}
                  style={{
                    borderLeft: `4px solid ${COLORS[hoveredRegion].stroke}`,
                    background: COLORS[hoveredRegion].fill + '66',
                  }}
                >
                  <div className={styles.goalCardText}>{goals[hoveredRegion]}</div>
                </div>
                <p className={styles.previewNote}>Click to see this stakeholder's full values →</p>
              </>
            ) : (
              <>
                <p className={styles.previewSubhead}>Shared values in this region:</p>
                <p className={styles.previewNote}>No shared values in this overlap yet.</p>
              </>
            )}

            <button className={styles.previewCta}>
              Click to explore →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
