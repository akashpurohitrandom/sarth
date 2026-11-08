'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { GalleryPhoto } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const IMAGE_TRANSITION_MS = 1200
const PIXEL_SIZE = 8

function imageUrl(path: string) {
  return path.startsWith('http') ? path : `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

type Props = { photographs: GalleryPhoto[]; logoUrl: string | null }

export default function Gallery({ photographs, logoUrl }: Props) {
  const [sequence] = useState(photographs)
  const [index, setIndex] = useState(0)
  const [outgoing, setOutgoing] = useState<GalleryPhoto | null>(null)
  const [dissolveReady, setDissolveReady] = useState(false)
  const wheelLock = useRef(false)
  const touchStart = useRef<number | null>(null)
  const dissolveCanvas = useRef<HTMLCanvasElement>(null)
  const current = sequence[index] ?? null

  useEffect(() => {
    if (sequence.length < 2) return
    const adjacent = [
      sequence[(index + 1) % sequence.length],
      sequence[(index - 1 + sequence.length) % sequence.length],
    ]
    adjacent.forEach(photo => {
      const image = new window.Image()
      image.src = imageUrl(photo.web_path)
    })
  }, [index, sequence])

  const finishTransition = useCallback(() => {
    setOutgoing(null)
    setDissolveReady(false)
  }, [])

  useEffect(() => {
    if (!outgoing) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishTransition()
      return
    }

    const canvas = dissolveCanvas.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      finishTransition()
      return
    }

    let animationFrame = 0
    let cancelled = false
    const image = new window.Image()
    image.onload = () => {
      if (cancelled) return

      const bounds = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      const width = canvas.width = Math.max(1, Math.round(bounds.width * ratio))
      const height = canvas.height = Math.max(1, Math.round(bounds.height * ratio))
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const imageWidth = image.naturalWidth * scale
      const imageHeight = image.naturalHeight * scale
      context.clearRect(0, 0, width, height)
      context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight)

      const cellSize = Math.max(8, Math.round(PIXEL_SIZE * ratio))
      const columns = Math.ceil(width / cellSize)
      const rows = Math.ceil(height / cellSize)
      const cells = Array.from({ length: columns * rows }, (_, cell) => cell)
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[cells[i], cells[j]] = [cells[j], cells[i]]
      }

      setDissolveReady(true)
      const startedAt = performance.now()
      let erased = 0
      const animate = (now: number) => {
        if (cancelled) return
        const progress = Math.min(1, (now - startedAt) / IMAGE_TRANSITION_MS)
        const target = Math.floor(progress * cells.length)
        context.globalCompositeOperation = 'destination-out'
        while (erased < target) {
          const cell = cells[erased++]
          const x = (cell % columns) * cellSize
          const y = Math.floor(cell / columns) * cellSize
          context.fillRect(x, y, cellSize, cellSize)
        }
        context.globalCompositeOperation = 'source-over'

        if (progress < 1) animationFrame = window.requestAnimationFrame(animate)
        else {
          context.clearRect(0, 0, width, height)
          finishTransition()
        }
      }
      animationFrame = window.requestAnimationFrame(animate)
    }
    image.onerror = finishTransition
    image.src = imageUrl(outgoing.web_path)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(animationFrame)
      image.onload = null
      image.onerror = null
    }
  }, [finishTransition, outgoing])

  const advance = useCallback((direction: 1 | -1) => {
    if (sequence.length < 2 || !current) return
    setOutgoing(current)
    setDissolveReady(false)
    setIndex(i => (i + direction + sequence.length) % sequence.length)
  }, [current, sequence.length])

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
      {current && (
        <div className="gallery-image-stage" key={current.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gallery-image" src={imageUrl(current.web_path)} alt="" fetchPriority="high" />
        </div>
      )}
      {outgoing && (
        <>
          <div className={`gallery-image-stage is-outgoing${dissolveReady ? ' is-dissolving' : ''}`} key={`outgoing-${outgoing.id}`} aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="gallery-image" src={imageUrl(outgoing.web_path)} alt="" />
          </div>
          <canvas ref={dissolveCanvas} className={`gallery-pixel-dissolve${dissolveReady ? ' is-ready' : ''}`} aria-hidden="true" />
        </>
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
          <button onClick={() => advance(1)} aria-label="Next photograph">↓</button>
        </div>
      )}
      <p className="gallery-hint">Scroll or use ↑ ↓ / space to explore</p>
    </main>
  )
}
