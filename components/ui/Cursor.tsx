'use client'

import { useEffect, useRef } from 'react'

export default function Cursor() {
  const dotRef  = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let mx = window.innerWidth  / 2
    let my = window.innerHeight / 2
    let rx = mx, ry = my
    let raf: number

    const onMove = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      if (dotRef.current) {
        dotRef.current.style.left = mx + 'px'
        dotRef.current.style.top  = my + 'px'
      }
    }

    const tick = () => {
      rx += (mx - rx) * 0.1
      ry += (my - ry) * 0.1
      if (ringRef.current) {
        ringRef.current.style.left = rx + 'px'
        ringRef.current.style.top  = ry + 'px'
      }
      raf = requestAnimationFrame(tick)
    }

    document.addEventListener('mousemove', onMove)
    raf = requestAnimationFrame(tick)
    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={dotRef}  className="cursor-dot"  aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      <style>{`
        .cursor-dot {
          position: fixed;
          width: 8px;
          height: 8px;
          background: #E8590C;
          border-radius: 50%;
          pointer-events: none;
          z-index: 9999;
          transform: translate(-50%, -50%);
          mix-blend-mode: screen;
          transition: width 0.2s, height 0.2s, opacity 0.2s;
        }
        .cursor-ring {
          position: fixed;
          width: 32px;
          height: 32px;
          border: 1px solid rgba(232, 89, 12, 0.45);
          border-radius: 50%;
          pointer-events: none;
          z-index: 9998;
          transform: translate(-50%, -50%);
          transition: width 0.35s cubic-bezier(0.4,0,0.2,1),
                      height 0.35s cubic-bezier(0.4,0,0.2,1),
                      border-color 0.3s,
                      background 0.3s;
        }
        body.cursor-hover .cursor-ring {
          width: 56px;
          height: 56px;
          border-color: rgba(232, 89, 12, 0.7);
          background: rgba(232, 89, 12, 0.04);
        }
        body.cursor-hover .cursor-dot {
          opacity: 0;
        }
        body.cursor-drag .cursor-ring {
          width: 50px;
          height: 50px;
          border-color: rgba(232, 89, 12, 0.6);
        }
        body.cursor-drag .cursor-dot {
          width: 12px;
          height: 12px;
        }
      `}</style>
    </>
  )
}
