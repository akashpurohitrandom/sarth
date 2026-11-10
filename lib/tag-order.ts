import type { GalleryPhoto } from '@/lib/supabase'

const SIMILARITY_LIMIT = 0.45
const metadataWeights = { tags: 0.45, city: 0.25, country: 0.18, year: 0.12 } as const
const RANDOM_CANDIDATE_POOL = 8

type PhotoProfile = {
  photo: GalleryPhoto
  tags: Set<string>
  city: string
  country: string
  year: string
}

function normalize(value: string | number | null | undefined) {
  return String(value ?? '').trim().toLocaleLowerCase()
}

function profile(photo: GalleryPhoto): PhotoProfile {
  return {
    photo,
    tags: new Set((photo.tags ?? []).map(normalize).filter(Boolean)),
    city: normalize(photo.city),
    country: normalize(photo.country),
    year: normalize(photo.year),
  }
}

/** Weighted similarity over metadata known on both photos; missing fields are ignored. */
function similarity(a: PhotoProfile, b: PhotoProfile) {
  let weightedScore = 0
  let comparableWeight = 0

  if (a.tags.size || b.tags.size) {
    let shared = 0
    for (const tag of a.tags) if (b.tags.has(tag)) shared++
    const union = a.tags.size + b.tags.size - shared
    weightedScore += metadataWeights.tags * (union ? shared / union : 0)
    comparableWeight += metadataWeights.tags
  }

  for (const field of ['city', 'country', 'year'] as const) {
    const left = a[field]
    const right = b[field]
    if (!left || !right) continue
    weightedScore += metadataWeights[field] * Number(left === right)
    comparableWeight += metadataWeights[field]
  }

  return comparableWeight ? weightedScore / comparableWeight : 0
}

function compareToRecent(candidate: PhotoProfile, recent: PhotoProfile[]) {
  if (!recent.length) return { safestSimilarity: 0, cost: 0 }
  const scores = recent.map(photo => similarity(candidate, photo))
  const safestSimilarity = Math.max(...scores)
  const averageSimilarity = scores.reduce((total, score) => total + score, 0) / scores.length
  return { safestSimilarity, cost: safestSimilarity * 0.75 + averageSimilarity * 0.25 }
}

function buildRandomSequence(photos: PhotoProfile[]) {
  const remaining = [...photos]
  const ordered: PhotoProfile[] = []

  if (!remaining.length) return ordered
  const first = Math.floor(Math.random() * remaining.length)
  ordered.push(remaining.splice(first, 1)[0])

  while (remaining.length) {
    const recent = ordered.slice(-2)
    const safePool: { item: PhotoProfile; cost: number }[] = []
    const fallbackPool: { item: PhotoProfile; cost: number }[] = []

    const keepAmongBest = (pool: { item: PhotoProfile; cost: number }[], entry: { item: PhotoProfile; cost: number }) => {
      let index = pool.findIndex(existing => entry.cost < existing.cost)
      if (index < 0) index = pool.length
      pool.splice(index, 0, entry)
      if (pool.length > RANDOM_CANDIDATE_POOL) pool.pop()
    }

    for (const item of remaining) {
      const { safestSimilarity, cost } = compareToRecent(item, recent)
      const entry = { item, cost }
      keepAmongBest(fallbackPool, entry)
      if (safestSimilarity < SIMILARITY_LIMIT) keepAmongBest(safePool, entry)
    }

    // Choose randomly among the best few to vary the sequence between page loads.
    const pool = safePool.length ? safePool : fallbackPool
    const choiceCount = Math.max(1, Math.ceil(pool.length / 2))
    const selected = pool[Math.floor(Math.random() * choiceCount)].item
    ordered.push(selected)
    remaining.splice(remaining.indexOf(selected), 1)
  }

  return ordered
}

function circularQuality(sequence: PhotoProfile[]) {
  if (sequence.length < 2) return { violations: 0, totalSimilarity: 0 }
  let violations = 0
  let totalSimilarity = 0

  for (let index = 0; index < sequence.length; index++) {
    for (const distance of [1, 2]) {
      if (distance >= sequence.length) continue
      const earlier = sequence[(index - distance + sequence.length) % sequence.length]
      const score = similarity(sequence[index], earlier)
      if (score >= SIMILARITY_LIMIT) violations++
      totalSimilarity += score
    }
  }

  return { violations, totalSimilarity }
}

/**
 * Randomly orders each photo once, preferring images unlike the previous two.
 * The circular score also discourages similar images across the loop boundary.
 */
export function randomizeByMetadataDiversity(photos: GalleryPhoto[]) {
  if (photos.length < 2) return [...photos]
  const profiles = photos.map(profile)
  const attempts = photos.length <= 300 ? 8 : photos.length <= 1000 ? 4 : 2
  let best = buildRandomSequence(profiles)
  let bestQuality = circularQuality(best)

  for (let attempt = 1; attempt < attempts; attempt++) {
    const candidate = buildRandomSequence(profiles)
    const quality = circularQuality(candidate)
    if (quality.violations < bestQuality.violations
      || (quality.violations === bestQuality.violations && quality.totalSimilarity < bestQuality.totalSimilarity)) {
      best = candidate
      bestQuality = quality
    }
  }

  return best.map(item => item.photo)
}
