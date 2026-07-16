# What is important to… — Shared-Goal Puzzle Prototype

An interactive React prototype of the descriptive-abstract scaffold from your
wireframes, restructured as a **Venn-style jigsaw puzzle**.

The board has six wedges around a central piece. Three wedges are
*perspectives*: **Me**, **My Doctor**, **My Caregiver**. Three are
*overlaps* between adjacent perspectives: **Me & my Doctor**, **Me & my
Caregiver**, **My Caregiver & my Clinician**. The center piece is **Our
Shared Goal** — where all three perspectives meet.

Example values are pre-populated for every wedge, representing the stage
*after* values have been elicited.

## Quick start

```bash
cd shared-goal-prototype
npm install
npm run dev
```

Vite opens it at http://localhost:5173.

## What you can do

- **See where pieces fit.** Connected pieces sit snug, with the puzzle tabs
  of each wedge nesting into the notches of its neighbors and the central
  clover. Disconnected pieces leave a clearly visible **dashed ghost outline**
  in the place where they belong, so the gap is unmistakable.
- **Disconnect a piece.** Click and drag any wedge outward. Once you've
  pulled it more than ~22 px the piece stays where you drop it — no
  accidental snap-backs. The toolbar's *Reconnect all pieces* button (or the
  per-piece *Reconnect* button) snaps everything home.
- **Move a value to a different wedge.** Drag a value chip onto another
  wedge — useful when a value really fits a different perspective or
  intersection.
- **Edit a value.** Click any value chip to open its editor (text +
  why-it-matters + how-it-helps fields).
- **Edit the shared goal.** Click the central piece.
- **Zoom into a wedge.** Click the wedge's name pill or magnifier icon to
  see all its values in detail.
- **Reset.** Toolbar's *Reset everything* button restores the seed example
  values and the connected layout.

## Files

```
shared-goal-prototype/
├── package.json          Vite + React 18 setup
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx          Entry point
    ├── App.jsx           All components + jigsaw geometry
    ├── App.css           Watercolor palette, wedge styling, ghost outlines
    └── data.js           Six sections + intersections data, "caregiver" copy
```

`src/data.js` is the place to change copy or example values. Each section
declares its `kind` (`primary` or `intersection`), its `angle` (where it sits
on the circle, in degrees: 0 = right, 90 = bottom, 180 = left, 270 = top), a
`halfWidthDeg` (40° for primaries, 20° for intersections), and a `color`. For
intersections, `blendFrom` and `blendTo` are the two parent-perspective
colors that produce the gradient blend in the wedge fill.

## Notes for extending

- **Persistence.** Wrap `useState` in a `useEffect` that reads/writes
  `localStorage` to keep edits between reloads.
- **Multi-user / live elicitation.** Replace `useState` with a small store
  (Zustand or Redux) so participants on different screens can collaborate.
- **Different geometry.** Adjust `BOARD`, `R_OUT`, `R_IN`, `TAB`, and
  `INNER_TAB` at the top of `App.jsx`. Adjust each section's `angle` and
  `halfWidthDeg` in `data.js`.
