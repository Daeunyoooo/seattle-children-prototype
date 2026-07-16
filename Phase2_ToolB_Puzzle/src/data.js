// 4 main puzzle quadrants (matching the wireframe), surrounding the center
// "Our Shared Goal" piece. Two diagonal intersection LABELS sit outside the
// wheel — they describe the shared territory between adjacent perspectives
// but do not own values themselves.

export const SHARED_GOAL =
  'For me to live a healthy, active life beyond illness with independence.'

export const INITIAL_SECTIONS = [
  {
    id: 'me',
    label: 'Me',
    color: '#f9c8d0', // pink (top)
    angle: 270,
    halfWidthDeg: 45,
    values: [
      {
        id: 'me-1',
        text: 'I want to feel normal and not different from my friends.',
        why: 'Friendships matter to me.',
        how: 'Doing the same activities as my friends.'
      },
      {
        id: 'me-2',
        text: "I don't want pain, needles, or hospital visits.",
        why: 'Procedures are scary and disruptive.',
        how: 'Less invasive care plans.'
      },
      {
        id: 'me-3',
        text: 'I want energy to play, school, and hang out.',
        why: 'Energy lets me show up for what I love.',
        how: 'Stable energy is the baseline.'
      }
    ]
  },
  {
    id: 'doctor',
    label: 'My Doctor',
    color: '#fde2a7', // warm yellow-green (right) — matches wireframe
    angle: 0,
    halfWidthDeg: 45,
    values: [
      {
        id: 'doc-1',
        text: 'Balance medical needs with happiness.',
        why: 'Care should fit life, not the other way.',
        how: 'A livable plan you can stick to.'
      },
      {
        id: 'doc-2',
        text: 'Track lab results & adjust care.',
        why: 'Data lets us catch problems early.',
        how: 'Regular monitoring keeps the plan accurate.'
      },
      {
        id: 'doc-3',
        text: 'Support sports & school goals.',
        why: 'Life outside the clinic matters too.',
        how: 'Adjust treatment around your schedule.'
      }
    ]
  },
  {
    id: 'shared',
    label: 'Both my Caregiver & my Doctor',
    color: '#cdeac0', // soft green (bottom) — the team-overlap quadrant
    angle: 90,
    halfWidthDeg: 45,
    values: [
      {
        id: 'sh-1',
        text: 'Work as a team around me, not over me.',
        why: 'I want to be part of decisions.',
        how: 'Including me builds trust.'
      },
      {
        id: 'sh-2',
        text: 'Help me live my life, not just manage my condition.',
        why: 'Quality of life is the point.',
        how: 'A wider lens leads to better choices.'
      },
      {
        id: 'sh-3',
        text: 'Support me to take care of myself.',
        why: 'Independence is the goal.',
        how: 'Teaching me self-care prepares me for adulthood.'
      }
    ]
  },
  {
    id: 'caregiver',
    label: 'My Caregiver',
    color: '#cfe7f5', // soft blue (left)
    angle: 180,
    halfWidthDeg: 45,
    values: [
      {
        id: 'cg-1',
        text: 'Establish a good routine for treatment.',
        why: 'Routines reduce day-to-day stress.',
        how: 'Predictability helps the family.'
      },
      {
        id: 'cg-2',
        text: 'Keep me safe and healthy.',
        why: 'Their love shows up as protectiveness.',
        how: 'Knowing I am safe lets them rest.'
      },
      {
        id: 'cg-3',
        text: 'Fewer complications.',
        why: 'Complications are the real fear.',
        how: 'Prevention guides every choice.'
      },
      {
        id: 'cg-4',
        text: 'We both want a good treatment routine.',
        why: 'A shared rhythm reduces friction.',
        how: 'Pre-planned check-ins and meals.'
      }
    ]
  }
]

// Diagonal intersection LABELS only — drawn as handwritten text outside the
// wheel between adjacent quadrants. They describe the overlap zone but do
// not have their own values bucket.
export const INTERSECTIONS = [
  { id: 'me-doctor', label: 'Me and my Doctor', angle: 315 }, // top-right
  { id: 'me-caregiver', label: 'Me and my Caregiver', angle: 225 } // top-left
]
