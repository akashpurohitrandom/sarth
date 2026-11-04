'use client'

import { useRef } from 'react'
import { HomepageCard } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Props {
  card: HomepageCard
  getImageUrl: (path: string) => string
  onPointerEnter: () => void
  onPointerLeave: () => void
  didDrag: () => boolean
}

export default function PhotoCard({
  card,
  getImageUrl,
  onPointerEnter,
  onPointerLeave,
  didDrag,
}: Props) {
  const router  = useRouter()
  const imgRef  = useRef<HTMLImageElement>(null)

  const handleClick = () => {
    if (didDrag()) return
    // Store canvas state for return navigation
    sessionStorage.setItem('sarth_return_story', card.story_slug)
    router.push(`/story/${card.story_slug}`)
  }

  const displayHeight = Math.round(
    card.display_width * (card.height / card.width)
  )

  const src = getImageUrl(card.thumbnail_path)

  return (
    <div
      className="photo-card"
      style={{
        position:        'absolute',
        left:            card.canvas_x,
        top:             card.canvas_y,
        width:           card.display_width,
        transform:       `rotate(${card.rotation}deg)`,
        transformOrigin: 'center center',
        cursor:          'none',
        willChange:      'transform',
      }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={handleClick}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={card.story_title}
          width={card.display_width}
          height={displayHeight}
          loading="lazy"
          style={{
            width:      '100%',
            height:     'auto',
            display:    'block',
            filter:     'brightness(0.82) saturate(0.9)',
            transition: 'filter 0.5s ease, transform 0.6s ease',
          }}
          onMouseEnter={e => {
            const img = e.currentTarget
            img.style.filter    = 'brightness(0.96) saturate(1.05)'
            img.style.transform = 'scale(1.02)'
          }}
          onMouseLeave={e => {
            const img = e.currentTarget
            img.style.filter    = 'brightness(0.82) saturate(0.9)'
            img.style.transform = 'scale(1)'
          }}
        />
      </div>
    </div>
  )
}
