'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const IMAGE_TRANSITION_MS = 1800

function imageUrl(path: string) {
  return path.startsWith('http') ? path : `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

type Props = { photographs: GalleryPhoto[]; logoUrl: string | null }

export default function Gallery({ photographs, logoUrl }: Props) {
  const [sequence] = useState(photographs)
  const [index, setIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<GalleryPhoto | null>(null)
  const wheelLock = useRef(false)
  const touchStart = useRef<number | null>(null)
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = sequence[index] ?? null

  const advance = useCallback((direction: 1 | -1) => {
    if (sequence.length < 2 || !current) return
    setOutgoing(current)
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
    transitionTimer.current = setTimeout(() => {
      setOutgoing(null)
      transitionTimer.current = null
    }, IMAGE_TRANSITION_MS)
    setIndex(i => (i + direction + sequence.length) % sequence.length)
  }, [current, sequence.length])

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current)
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

  const location = [current?.city, current?.country, current?.year].filter(Boolean).join(', ')

  return (
    <main className="gallery" aria-label="Sārth photographs"
      onTouchStart={event => { touchStart.current = event.touches[0]?.clientY ?? null }}
      onTouchEnd={event => {
        if (touchStart.current === null) return
        const delta = touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current)
        if (Math.abs(delta) > 40) advance(delta > 0 ? 1 : -1)
        touchStart.current = null
      }}>
      {outgoing && (
        <div className="gallery-image-stage is-outgoing" key={`outgoing-${outgoing.id}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-image" src={imageUrl(outgoing.web_path)} alt="" />
        </div>
      )}
      {current && (
        <div className="gallery-image-stage" key={current.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-image" src={imageUrl(current.web_path)} alt="" fetchPriority="high" />
        </div>
      )}
      <div className="gallery-shade" aria-hidden="true" />

      <a className="gallery-wordmark" href="/" aria-label="Sārth home">
        {logoUrl ? <img src={logoUrl} alt="Sārth" /> : 'Sārth'}
      </a>

      {current ? (
        <div className="gallery-details" aria-live="polite" key={`details-${current.id}`}>
          {location && <p className="gallery-photo-meta">{location}</p>}
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
