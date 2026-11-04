'use client'

import { useEffect, useState } from 'react'
import { supabase, Story } from '@/lib/supabase'

export default function AdminDashboard() {
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('stories')
      .select('*')
      .order('created_at', { ascending: false })
    setStories(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePublish = async (story: Story) => {
    await supabase
      .from('stories')
      .update({ published: !story.published })
      .eq('id', story.id)
    load()
  }

  const deleteStory = async (id: string) => {
    if (!confirm('Delete this story? This cannot be undone.')) return
    await supabase.from('stories').delete().eq('id', id)
    load()
  }

  if (loading) return (
    <div style={{ padding: '4rem 2.5rem', color: '#555', fontSize: '0.8rem' }}>
      Loading…
    </div>
  )

  return (
    <main style={{ padding: '3rem 2.5rem', maxWidth: '900px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{
          fontFamily:    'DM Serif Display, Georgia, serif',
          fontStyle:     'italic',
          fontSize:      '2.2rem',
          color:         '#F2EDE6',
          marginBottom:  '0.5rem',
        }}>Stories</h1>
        <p style={{ fontSize: '0.8rem', color: '#555' }}>
          {stories.length} {stories.length === 1 ? 'story' : 'stories'} total
        </p>
      </div>

      {stories.length === 0 ? (
        <div style={{
          padding:       '4rem',
          textAlign:     'center',
          border:        '1px dashed rgba(255,255,255,0.08)',
          borderRadius:  '8px',
          color:         '#444',
        }}>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            No stories yet.
          </p>
          <a href="/admin/new" style={{
            fontSize:      '0.65rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color:         '#E8590C',
          }}>Create your first story →</a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {stories.map(story => (
            <div key={story.id} style={{
              display:       'grid',
              gridTemplateColumns: '1fr auto',
              gap:           '1.5rem',
              alignItems:    'center',
              padding:       '1.2rem 0',
              borderBottom:  '1px solid rgba(255,255,255,0.06)',
            }}>
              <div>
                <h2 style={{
                  fontFamily:   'DM Serif Display, Georgia, serif',
                  fontStyle:    'italic',
                  fontSize:     '1.15rem',
                  color:        '#F2EDE6',
                  marginBottom: '0.3rem',
                }}>
                  {story.title}
                </h2>
                <p style={{ fontSize: '0.72rem', color: '#444', letterSpacing: '0.06em' }}>
                  /{story.slug}
                  {story.introduction && (
                    <span style={{ marginLeft: '1rem', color: '#333' }}>
                      {story.introduction.slice(0, 60)}…
                    </span>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span style={{
                  fontSize:      '0.58rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  padding:       '3px 8px',
                  borderRadius:  '3px',
                  background:    story.published
                    ? 'rgba(232,89,12,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  color: story.published ? '#E8590C' : '#444',
                }}>
                  {story.published ? 'Live' : 'Draft'}
                </span>
                <button
                  onClick={() => togglePublish(story)}
                  style={{
                    fontSize:      '0.62rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color:         '#555',
                    padding:       '4px 10px',
                    border:        '1px solid rgba(255,255,255,0.08)',
                    borderRadius:  '4px',
                    cursor:        'pointer',
                    background:    'none',
                    transition:    'color 0.2s, border-color 0.2s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color        = '#F2EDE6'
                    e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.2)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color        = '#555'
                    e.currentTarget.style.borderColor  = 'rgba(255,255,255,0.08)'
                  }}
                >
                  {story.published ? 'Unpublish' : 'Publish'}
                </button>
                <a
                  href={`/story/${story.slug}`}
                  target="_blank"
                  rel="noopener"
                  style={{
                    fontSize:      '0.62rem',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color:         '#555',
                    transition:    'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E8590C')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#555')}
                >
                  View ↗
                </a>
                <button
                  onClick={() => deleteStory(story.id)}
                  style={{
                    fontSize:  '0.75rem',
                    color:     '#333',
                    background: 'none',
                    border:    'none',
                    cursor:    'pointer',
                    padding:   '4px',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#E8590C')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#333')}
                  title="Delete story"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
