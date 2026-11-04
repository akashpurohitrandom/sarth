'use client'

import { useEffect, useState, useCallback } from 'react'
import { Photograph } from '@/lib/supabase'

interface Props {
  photographs:  Photograph[]
  initialIndex: number
  onClose:      () => void
  getImageUrl:  (path: string) => string
}

export default function Viewer({ photographs, initialIndex, onClose, getImageUrl }: Props) {
  const [index, setIndex] = useState(initialIndex)

  const prev = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const next = useCallback(() => {
    setIndex(i => Math.min(photographs.length - 1, i + 1))
  }, [photographs.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')      onClose()
      if (e.key === 'ArrowLeft')   prev()
      if (e.key === 'ArrowRight')  next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  // Prevent body scroll while viewer open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const photo = photographs[index]
  const src   = getImageUrl(photo.web_path || photo.storage_path)

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     '#000',
        zIndex:         999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        animation:      'viewerIn 0.35s ease',
      }}
      onClick={onClose}
    >
      {/* Image */}
      <img
        src={src}
        alt={photo.caption || ''}
        style={{
          maxWidth:   '100vw',
          maxHeight:  '100vh',
          objectFit:  'contain',
          display:    'block',
          cursor:     'none',
          userSelect: 'none',
        }}
        onClick={e => e.stopPropagation()}
        draggable={false}
      />

      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position:      'fixed',
          top:           '1.5rem',
          right:         '1.5rem',
          width:         '38px',
          height:        '38px',
          border:        '1px solid rgba(232,89,12,0.35)',
          borderRadius:  '50%',
          color:         '#E8590C',
          fontSize:      '0.85rem',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          cursor:        'none',
          background:    'rgba(0,0,0,0.6)',
          transition:    'background 0.2s, border-color 0.2s',
          zIndex:        1000,
        }}
        onMouseEnter={e => {
          const b = e.currentTarget
          b.style.background   = 'rgba(232,89,12,0.12)'
          b.style.borderColor  = '#E8590C'
        }}
        onMouseLeave={e => {
          const b = e.currentTarget
          b.style.background   = 'rgba(0,0,0,0.6)'
          b.style.borderColor  = 'rgba(232,89,12,0.35)'
        }}
      >
        ✕
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); prev() }}
          style={{
            position:  'fixed',
            left:      '1.5rem',
            top:       '50%',
            transform: 'translateY(-50%)',
            width:     '42px',
            height:    '42px',
            border:    '1px solid rgba(232,89,12,0.3)',
            borderRadius: '50%',
            color:     '#E8590C',
            display:   'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor:    'none',
            background: 'rgba(0,0,0,0.5)',
            transition: 'background 0.2s',
            zIndex:    1000,
            fontSize:  '0.9rem',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,89,12,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
        >
          ←
        </button>
      )}

      {/* Next */}
      {index < photographs.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); next() }}
          style={{
            position:  'fixed',
            right:     '1.5rem',
            top:       '50%',
            transform: 'translateY(-50%)',
            width:     '42px',
            height:    '42px',
            border:    '1px solid rgba(232,89,12,0.3)',
            borderRadius: '50%',
            color:     '#E8590C',
            display:   'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor:    'none',
            background: 'rgba(0,0,0,0.5)',
            transition: 'background 0.2s',
            zIndex:    1000,
            fontSize:  '0.9rem',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,89,12,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.5)')}
        >
          →
        </button>
      )}

      {/* Counter */}
      <div style={{
        position:      'fixed',
        bottom:        '1.8rem',
        left:          '50%',
        transform:     'translateX(-50%)',
        fontSize:      '0.6rem',
        letterSpacing: '0.24em',
        color:         'rgba(242,237,230,0.3)',
        zIndex:        1000,
      }}>
        {index + 1} / {photographs.length}
      </div>

      <style>{`
        @keyframes viewerIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
