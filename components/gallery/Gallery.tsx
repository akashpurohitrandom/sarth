'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GalleryPhoto, GalleryStory } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function imageUrl(path: string) {
  return path.startsWith('http') ? path : `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

function shuffle<T>(items: T[]) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

type Props = { stories: GalleryStory[] }

export default function Gallery({ stories }: Props) {
  const allPhotos = useMemo(() => stories.flatMap(story => story.photographs), [stories])
  const [storyId, setStoryId] = useState<string | null>(null)
  const [sequence, setSequence] = useState<GalleryPhoto[]>(allPhotos)
  const [index, setIndex] = useState(0)
  const [currentId, setCurrentId] = useState<string | null>(allPhotos[0]?.id ?? null)
  const wheelLock = useRef(false)
  const touchStart = useRef<number | null>(null)

  const currentPhotos = useMemo(
    () => storyId ? stories.find(story => story.id === storyId)?.photographs ?? [] : allPhotos,
    [allPhotos, stories, storyId],
  )
  const current = currentPhotos.find(photo => photo.id === currentId) ?? currentPhotos[0] ?? null
  const activeStory = stories.find(story => story.id === storyId) ?? null

  const chooseSequence = useCallback((photos: GalleryPhoto[], nextStoryId: string | null) => {
    const next = shuffle(photos)
    setStoryId(nextStoryId)
    setSequence(next)
    setIndex(0)
    setCurrentId(next[0]?.id ?? null)
  }, [])

  const advance = useCallback((direction: 1 | -1) => {
    if (sequence.length < 2) return
    const nextIndex = (index + direction + sequence.length) % sequence.length
    setIndex(nextIndex)
    setCurrentId(sequence[nextIndex].id)
  }, [index, sequence])

  useEffect(() => {
    if (allPhotos.length > 1) chooseSequence(allPhotos, null)
  // Select a new random opening image once in the browser.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return
      if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault()
        advance(1)
      } else if (['ArrowUp', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        advance(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 12 || wheelLock.current) return
      event.preventDefault()
      wheelLock.current = true
      advance(event.deltaY > 0 ? 1 : -1)
      window.setTimeout(() => { wheelLock.current = false }, 650)
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [advance])

  const formattedDate = current?.taken_on
    ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${current.taken_on}T00:00:00Z`))
    : null
  const location = [current?.city, current?.country].filter(Boolean).join(', ')

  return (
    <main className="gallery" aria-label="Sārth photographs"
      onTouchStart={event => { touchStart.current = event.touches[0]?.clientY ?? null }}
      onTouchEnd={event => {
        if (touchStart.current === null) return
        const delta = touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current)
        if (Math.abs(delta) > 40) advance(delta > 0 ? 1 : -1)
        touchStart.current = null
      }}>
      {current && (
        <div className="gallery-image-stage" key={current.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-image" src={imageUrl(current.web_path)} alt={current.photograph_title || ''} fetchPriority="high" />
        </div>
      )}
      <div className="gallery-shade" aria-hidden="true" />

      <a className="gallery-wordmark" href="/" aria-label="Sārth home">Sārth</a>

      {stories.length > 0 && (
        <nav className="gallery-stories" aria-label="Browse stories">
          <button className={`gallery-story ${storyId === null ? 'is-selected' : ''}`} onClick={() => chooseSequence(allPhotos, null)}>
            {storyId === null && <span className="gallery-selected-mark" aria-hidden="true">↳</span>}
            <span>All photographs</span>
          </button>
          {stories.map(story => (
            <button key={story.id} className={`gallery-story ${story.id === storyId ? 'is-selected' : ''}`}
              onClick={() => chooseSequence(story.photographs, story.id)} disabled={!story.photographs.length}>
              {story.id === storyId && <span className="gallery-selected-mark" aria-hidden="true">↳</span>}
              <span>{story.title}</span>
            </button>
          ))}
        </nav>
      )}

      {current ? (
        <div className="gallery-details" aria-live="polite" key={`details-${current.id}`}>
          {activeStory && <p className="gallery-context">{activeStory.title}</p>}
          {current.photograph_title && <p className="gallery-photo-title">{current.photograph_title}</p>}
          {(formattedDate || location) && (
            <p className="gallery-photo-meta">{[formattedDate, location].filter(Boolean).join('  ·  ')}</p>
          )}
        </div>
      ) : (
        <div className="gallery-empty">
          <p className="gallery-empty-title">Sārth</p>
          <p>Photographs will find their way here.</p>
        </div>
      )}

      {current && sequence.length > 1 && (
        <div className="gallery-controls" aria-label="Photograph navigation">
          <button onClick={() => advance(-1)} aria-label="Previous photograph">↑</button>
          <span>{String(index + 1).padStart(2, '0')} / {String(sequence.length).padStart(2, '0')}</span>
          <button onClick={() => advance(1)} aria-label="Next photograph">↓</button>
        </div>
      )}
      <p className="gallery-hint">Scroll or use ↑ ↓ / space to explore</p>
    </main>
  )
}
