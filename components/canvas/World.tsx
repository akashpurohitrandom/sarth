'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { HomepageCard } from '@/lib/supabase'
import PhotoCard from './PhotoCard'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

interface Props {
  cards: HomepageCard[]
}

export default function World({ cards }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const worldRef  = useRef<HTMLDivElement>(null)

  // Pan state
  const panX    = useRef(0)
  const panY    = useRef(0)
  const targetX = useRef(0)
  const targetY = useRef(0)

  // Drag state
  const dragging  = useRef(false)
  const startMX   = useRef(0)
  const startMY   = useRef(0)
  const startPX   = useRef(0)
  const startPY   = useRef(0)
  const velX      = useRef(0)
  const velY      = useRef(0)
  const lastMX    = useRef(0)
  const lastMY    = useRef(0)
  const hasDragged = useRef(false)
  const dragThreshold = 6

  // Touch state
  const touch = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const [hinting, setHinting] = useState(true)

  const applyTransform = useCallback(() => {
    if (!worldRef.current) return
    worldRef.current.style.transform =
      `translate(${panX.current}px, ${panY.current}px)`
  }, [])

  // Centre world on mount
  useEffect(() => {
    panX.current    = window.innerWidth  / 2
    panY.current    = window.innerHeight / 2
    targetX.current = panX.current
    targetY.current = panY.current
    applyTransform()
  }, [applyTransform])

  // Drag handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      dragging.current  = true
      hasDragged.current = false
      startMX.current   = e.clientX
      startMY.current   = e.clientY
      startPX.current   = panX.current
      startPY.current   = panY.current
      lastMX.current    = e.clientX
      lastMY.current    = e.clientY
      velX.current = 0; velY.current = 0
      document.body.classList.add('cursor-drag')
      e.preventDefault()
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - startMX.current
      const dy = e.clientY - startMY.current
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
        hasDragged.current = true
        setHinting(false)
      }
      velX.current = e.clientX - lastMX.current
      velY.current = e.clientY - lastMY.current
      lastMX.current = e.clientX
      lastMY.current = e.clientY
      panX.current = startPX.current + dx
      panY.current = startPY.current + dy
      applyTransform()
    }

    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      document.body.classList.remove('cursor-drag')
      // Momentum glide
      const glide = () => {
        if (Math.abs(velX.current) < 0.4 && Math.abs(velY.current) < 0.4) return
        velX.current *= 0.91
        velY.current *= 0.91
        panX.current += velX.current
        panY.current += velY.current
        applyTransform()
        requestAnimationFrame(glide)
      }
      requestAnimationFrame(glide)
    }

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touch.current = { x: t.clientX, y: t.clientY, px: panX.current, py: panY.current }
      hasDragged.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touch.current) return
      const t = e.touches[0]
      const dx = t.clientX - touch.current.x
      const dy = t.clientY - touch.current.y
      if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
        hasDragged.current = true
        setHinting(false)
      }
      panX.current = touch.current.px + dx
      panY.current = touch.current.py + dy
      applyTransform()
    }

    const onTouchEnd = () => { touch.current = null }

    canvas.addEventListener('mousedown',  onMouseDown)
    window.addEventListener('mousemove',  onMouseMove)
    window.addEventListener('mouseup',    onMouseUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove',  onTouchMove,  { passive: true })
    canvas.addEventListener('touchend',   onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown',  onMouseDown)
      window.removeEventListener('mousemove',  onMouseMove)
      window.removeEventListener('mouseup',    onMouseUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove',  onTouchMove)
      canvas.removeEventListener('touchend',   onTouchEnd)
    }
  }, [applyTransform])

  // Hide hint after 4s
  useEffect(() => {
    const t = setTimeout(() => setHinting(false), 4000)
    return () => clearTimeout(t)
  }, [])

  const didDrag = useCallback(() => hasDragged.current, [])

  const onPointerEnter = useCallback(() => {
    document.body.classList.add('cursor-hover')
  }, [])

  const onPointerLeave = useCallback(() => {
    document.body.classList.remove('cursor-hover')
  }, [])

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset:    0,
        overflow: 'hidden',
        cursor:   'none',
      }}
    >
      {/* The infinite world */}
      <div
        ref={worldRef}
        style={{
          position: 'absolute',
          width:    0,
          height:   0,
          top:      0,
          left:     0,
          willChange: 'transform',
        }}
      >
        {cards.map(card => (
          <PhotoCard
            key={card.photograph_id}
            card={card}
            getImageUrl={getImageUrl}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            didDrag={didDrag}
          />
        ))}
      </div>

      {/* Wordmark — fixed top left */}
      <div style={{
        position:      'fixed',
        top:           '2rem',
        left:          '2.5rem',
        zIndex:        100,
        pointerEvents: 'none',
      }}>
        <span className="wordmark" style={{ fontSize: '1.6rem' }}>Sārth</span>
      </div>

      {/* Drag hint */}
      {hinting && (
        <div style={{
          position:       'fixed',
          bottom:         '3rem',
          left:           '50%',
          transform:      'translateX(-50%)',
          display:        'flex',
          alignItems:     'center',
          gap:            '0.75rem',
          fontSize:       '0.6rem',
          letterSpacing:  '0.3em',
          textTransform:  'uppercase',
          color:          '#555',
          zIndex:         50,
          pointerEvents:  'none',
          animation:      'fadeInHint 1s ease 1s both',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5" opacity="0.6">
            <path d="M5 9l7-7 7 7M5 15l7 7 7-7"/>
          </svg>
          Drag to explore
        </div>
      )}

      {/* Empty state */}
      {cards.length === 0 && (
        <div style={{
          position:       'fixed',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '1rem',
          pointerEvents:  'none',
        }}>
          <span className="wordmark" style={{ fontSize: '3rem' }}>Sārth</span>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em',
                      textTransform: 'uppercase', color: '#555' }}>
            Coming soon
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeInHint {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
