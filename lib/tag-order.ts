import type { GalleryPhoto } from '@/lib/supabase'

export function randomizeByTagDistance(photos: GalleryPhoto[]) {
  const remaining = [...photos]
  const ordered: GalleryPhoto[] = []
  while (remaining.length) {
    if (!ordered.length) {
      const first = Math.floor(Math.random() * remaining.length)
      ordered.push(remaining.splice(first, 1)[0])
      continue
    }
    const previousTags = new Set(ordered[ordered.length - 1].tags ?? [])
    let leastOverlap = Number.POSITIVE_INFINITY
    let candidates: number[] = []
    remaining.forEach((photo, index) => {
      const overlap = (photo.tags ?? []).filter(tag => previousTags.has(tag)).length
      if (overlap < leastOverlap) {
        leastOverlap = overlap
        candidates = [index]
      } else if (overlap === leastOverlap) candidates.push(index)
    })
    const selected = candidates[Math.floor(Math.random() * candidates.length)]
    ordered.push(remaining.splice(selected, 1)[0])
  }
  return ordered
}
