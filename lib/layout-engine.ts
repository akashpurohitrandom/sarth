import { Photograph, HomepageCard, HomepageLayout } from './supabase'

// Size variants for canvas cards (display width in px)
const SIZE_VARIANTS = [160, 220, 300, 380, 460]
const SIZE_WEIGHTS  = [0.15, 0.25, 0.35, 0.15, 0.10] // probability weights

// Rotation range
const MAX_ROTATION = 4 // degrees

// Minimum gap between card edges
const MIN_GAP = 80

// Seeded random — same seed = same sequence
function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function pickSize(rand: () => number): number {
  const r = rand()
  let cumulative = 0
  for (let i = 0; i < SIZE_VARIANTS.length; i++) {
    cumulative += SIZE_WEIGHTS[i]
    if (r < cumulative) return SIZE_VARIANTS[i]
  }
  return SIZE_VARIANTS[2]
}

function getAspect(w: number, h: number): 'portrait' | 'landscape' | 'square' {
  const ratio = w / h
  if (ratio > 1.15)  return 'landscape'
  if (ratio < 0.85)  return 'portrait'
  return 'square'
}

function getDisplayHeight(displayWidth: number, origW: number, origH: number): number {
  return Math.round(displayWidth * (origH / origW))
}

function boxesOverlapTooMuch(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
  allowedOverlap = 0.12
): boolean {
  const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx))
  const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by))
  const overlapArea = overlapX * overlapY
  const smallerArea = Math.min(aw * ah, bw * bh)
  return overlapArea > smallerArea * allowedOverlap
}

// Generate canvas positions that feel curated
// Cards radiate outward from origin in clusters
function generatePositions(
  count: number,
  sizes: { w: number; h: number }[],
  rand: () => number
): { x: number; y: number }[] {
  const positions: { x: number; y: number; w: number; h: number }[] = []

  // Cluster centres — organic, not a grid
  const clusterCentres = [
    { x: -200, y: -180 },
    { x:  280, y: -260 },
    { x: -420, y:   80 },
    { x:  200, y:  160 },
    { x: -160, y:  340 },
    { x:  620, y: -120 },
    { x:  700, y:  320 },
    { x: -840, y: -180 },
    { x: -200, y: -600 },
    { x:  420, y: -560 },
    { x: -100, y:  660 },
    { x:  440, y:  580 },
    { x: 1100, y:  200 },
    { x:-1200, y:  -60 },
    { x:  300, y:-1060 },
    { x:  980, y: -380 },
    { x: -960, y:  380 },
    { x:  160, y: -900 },
    { x: -680, y:  780 },
    { x: 1320, y:  420 },
  ]

  for (let i = 0; i < count; i++) {
    const cluster = clusterCentres[i % clusterCentres.length]
    const sw = sizes[i].w
    const sh = sizes[i].h

    let x: number, y: number
    let attempts = 0

    do {
      // Jitter within cluster
      const jitterX = (rand() - 0.5) * 280
      const jitterY = (rand() - 0.5) * 220
      x = Math.round(cluster.x + jitterX - sw / 2)
      y = Math.round(cluster.y + jitterY - sh / 2)
      attempts++

      // Check overlap with all placed cards
      const tooClose = positions.some(p =>
        boxesOverlapTooMuch(x, y, sw, sh, p.x, p.y, p.w, p.h)
      )
      if (!tooClose || attempts > 30) break

    } while (true)

    positions.push({ x, y, w: sw, h: sh })
  }

  return positions.map(p => ({ x: p.x, y: p.y }))
}

// ── Main export ──────────────────────────────────────────────
// Takes stories with their selected photograph and generates
// a complete homepage layout with positions, sizes, rotations.

export type StoryWithPhoto = {
  story_id: string
  story_title: string
  story_slug: string
  photograph: Photograph
}

export function generateLayout(
  stories: StoryWithPhoto[],
  seed: number
): HomepageLayout {
  const rand = seededRandom(seed)

  if (!stories.length) return { cards: [] }

  // Shuffle stories so order varies each generation
  const shuffled = [...stories].sort(() => rand() - 0.5)

  // Pick sizes — alternate large/small, avoid two large adjacent
  const displayWidths: number[] = []
  let lastWasLarge = false

  for (let i = 0; i < shuffled.length; i++) {
    let size = pickSize(rand)
    if (lastWasLarge && size >= 380) size = SIZE_VARIANTS[Math.floor(rand() * 2) + 1]
    displayWidths.push(size)
    lastWasLarge = size >= 380
  }

  // Calculate display heights
  const sizes = shuffled.map((s, i) => {
    const p = s.photograph
    const w = p.width  || 1200
    const h = p.height || 800
    const dw = displayWidths[i]
    const dh = getDisplayHeight(dw, w, h)
    return { w: dw, h: dh }
  })

  // Generate positions
  const positions = generatePositions(shuffled.length, sizes, rand)

  // Generate rotations — vary, never same twice in a row
  let lastRot = 0
  const rotations = shuffled.map(() => {
    let rot: number
    do {
      rot = parseFloat(((rand() * MAX_ROTATION * 2) - MAX_ROTATION).toFixed(2))
    } while (Math.abs(rot - lastRot) < 0.5)
    lastRot = rot
    return rot
  })

  // Assemble cards
  const cards: HomepageCard[] = shuffled.map((s, i) => {
    const p = s.photograph
    const w = p.width  || 1200
    const h = p.height || 800

    return {
      story_id:      s.story_id,
      photograph_id: p.id,
      story_title:   s.story_title,
      story_slug:    s.story_slug,
      thumbnail_path: p.thumbnail_path || p.web_path || p.storage_path,
      web_path:       p.web_path       || p.storage_path,
      width:  w,
      height: h,
      canvas_x:      positions[i].x,
      canvas_y:      positions[i].y,
      display_width: displayWidths[i],
      rotation:      rotations[i],
      aspect:        getAspect(w, h),
    }
  })

  return { cards }
}

// Generate a seed that is stable for 1 hour
export function getHourlySeed(): number {
  const now = new Date()
  const hourKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`
  let hash = 0
  for (let i = 0; i < hourKey.length; i++) {
    const char = hourKey.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}
