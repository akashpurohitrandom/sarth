'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, Story, Photograph } from '@/lib/supabase'
import Cursor from '@/components/ui/Cursor'
import Viewer from '@/components/story/Viewer'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

function getImageUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${SUPABASE_URL}/storage/v1/object/public/${path}`
}

// Museum layout positions — left / centre / right, varying sizes
type LayoutSlot = {
  align:  'left' | 'center' | 'right'
  width:  string
  margin: string
}

const LAYOUT_SLOTS: LayoutSlot[] = [
  { align: 'left',   width: '48%',  margin: '0 0 6vh 0' },
  { align: 'right',  width: '40%',  margin: '0 0 8vh 0' },
  { align: 'center', width: '58%',  margin: '0 0 10vh 0' },
  { align: 'left',   width: '34%',  margin: '0 0 6vh 0' },
  { align: 'right',  width: '52%',  margin: '0 0 7vh 0' },
  { align: 'center', width: '42%',  margin: '0 0 9vh 0' },
  { align: 'left',   width: '56%',  margin: '0 0 8vh 0' },
  { align: 'right',  width: '36%',  margin: '0 0 6vh 0' },
]

export default function StoryPage() {
  const { slug } = useParams<{ slug: string }>()
  const router   = useRouter()

  const [story,       setStory]       = useState<Story | null>(null)
  const [photographs, setPhotographs] = useState<Photograph[]>([])
  const [loading,     setLoading]     = useState(true)
  const [viewerOpen,  setViewerOpen]  = useState(false)
  const [viewerIndex, setViewerIndex] = useState(0)

  useEffect(() => {
    document.body.classList.add('scrollable')
    return () => document.body.classList.remove('scrollable')
  }, [])

  useEffect(() => {
    async function load() {
      const { data: storyData } = await supabase
        .from('stories')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .single()

      if (!storyData) { router.push('/'); return }
      setStory(storyData)

      const { data: photos } = await supabase
        .from('photographs')
        .select('*')
        .eq('story_id', storyData.id)
        .order('display_order')

      setPhotographs(photos ?? [])
      setLoading(false)
    }
    load()
  }, [slug, router])

  const openViewer = useCallback((index: number) => {
    setViewerIndex(index)
    setViewerOpen(true)
  }, [])

  const closeViewer = useCallback(() => {
    setViewerOpen(false)
  }, [])

  const handleBack = () => {
    router.push('/')
  }

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111111',
      }}>
        <span className="wordmark" style={{ fontSize: '2rem', opacity: 0.4 }}>Sārth</span>
      </div>
    )
  }

  if (!story) return null

  return (
    <>
      <Cursor />

      <main style={{
        background: '#111111',
        minHeight:  '100vh',
        paddingBottom: '20vh',
      }}>

        {/* Back button */}
        <button
          onClick={handleBack}
          style={{
            position:      'fixed',
            top:           '2rem',
            left:          '2.5rem',
            zIndex:        50,
            fontSize:      '0.65rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color:         '#555',
            display:       'flex',
            alignItems:    'center',
            gap:           '0.6rem',
            cursor:        'none',
            transition:    'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#E8590C')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555')}
        >
          ← Sārth
        </button>

        {/* Story header */}
        <div style={{
          padding:   '18vh 10vw 8vh',
          maxWidth:  '700px',
        }}>
          <h1 style={{
            fontFamily:    'DM Serif Display, Georgia, serif',
            fontStyle:     'italic',
            fontSize:      'clamp(2.8rem, 6vw, 5.5rem)',
            lineHeight:    0.92,
            letterSpacing: '-0.02em',
            color:         '#F2EDE6',
            marginBottom:  '2.5rem',
          }}>
            {story.title}
          </h1>

          {story.introduction && (
            <p style={{
              fontFamily:  'DM Sans, system-ui, sans-serif',
              fontWeight:  300,
              fontSize:    '1rem',
              lineHeight:  1.85,
              color:       'rgba(242,237,230,0.55)',
              maxWidth:    '520px',
            }}>
              {story.introduction}
            </p>
          )}
        </div>

        {/* Photographs — museum layout */}
        <div style={{ padding: '0 8vw' }}>
          {photographs.map((photo, index) => {
            const slot   = LAYOUT_SLOTS[index % LAYOUT_SLOTS.length]
            const src    = getImageUrl(photo.web_path || photo.storage_path)

            const marginLeft  = slot.align === 'left'   ? '0'    :
                                slot.align === 'right'  ? 'auto' : 'auto'
            const marginRight = slot.align === 'right'  ? '0'    :
                                slot.align === 'left'   ? 'auto' : 'auto'

            return (
              <div
                key={photo.id}
                style={{
                  width:       slot.width,
                  marginLeft,
                  marginRight,
                  marginBottom: slot.margin.split(' ')[2] || '6vh',
                  cursor:      'none',
                }}
                onClick={() => openViewer(index)}
                onMouseEnter={() => document.body.classList.add('cursor-hover')}
                onMouseLeave={() => document.body.classList.remove('cursor-hover')}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={photo.caption || story.title}
                  style={{
                    width:      '100%',
                    height:     'auto',
                    display:    'block',
                    filter:     'brightness(0.88) saturate(0.92)',
                    transition: 'filter 0.5s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLImageElement).style.filter =
                      'brightness(1) saturate(1)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLImageElement).style.filter =
                      'brightness(0.88) saturate(0.92)'
                  }}
                />
                {photo.caption && (
                  <p style={{
                    marginTop:     '0.75rem',
                    fontSize:      '0.75rem',
                    letterSpacing: '0.04em',
                    color:         'rgba(242,237,230,0.35)',
                    fontStyle:     'italic',
                    fontFamily:    'DM Serif Display, Georgia, serif',
                  }}>
                    {photo.caption}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </main>

      {/* Fullscreen viewer */}
      {viewerOpen && (
        <Viewer
          photographs={photographs}
          initialIndex={viewerIndex}
          onClose={closeViewer}
          getImageUrl={getImageUrl}
        />
      )}
    </>
  )
}
