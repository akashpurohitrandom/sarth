'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type UploadFile = {
  file:     File
  preview:  string
  caption:  string
  status:   'pending' | 'uploading' | 'done' | 'error'
  progress: number
}

export default function NewStoryPage() {
  const router = useRouter()
  const dropRef = useRef<HTMLDivElement>(null)

  const [title,        setTitle]        = useState('')
  const [introduction, setIntroduction] = useState('')
  const [files,        setFiles]        = useState<UploadFile[]>([])
  const [draggingOver, setDraggingOver] = useState(false)
  const [publishing,   setPublishing]   = useState(false)
  const [error,        setError]        = useState('')

  // Accepted image types
  const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => ACCEPTED.includes(f.type))
    const newFiles: UploadFile[] = arr.map(f => ({
      file:     f,
      preview:  URL.createObjectURL(f),
      caption:  '',
      status:   'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...newFiles])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Drag handlers
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(true)
  }
  const onDragLeave = () => setDraggingOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    addFiles(e.dataTransfer.files)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const updateCaption = (index: number, caption: string) => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, caption } : f))
  }

  const handlePublish = async () => {
    if (!title.trim())    { setError('Enter a story title.'); return }
    if (!files.length)    { setError('Add at least one photograph.'); return }
    setError('')
    setPublishing(true)

    try {
      // 1. Create story record
      const { data: story, error: storyError } = await supabase
        .from('stories')
        .insert({ title: title.trim(), introduction: introduction.trim() || null, published: true })
        .select()
        .single()

      if (storyError || !story) throw new Error(storyError?.message || 'Failed to create story')

      // 2. Upload each photograph
      for (let i = 0; i < files.length; i++) {
        const uf = files[i]
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'uploading', progress: 10 } : f
        ))

        const ext      = uf.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${story.id}/${Date.now()}-${i}.${ext}`

        // Upload original to originals bucket
        const { error: uploadErr } = await supabase.storage
          .from('originals')
          .upload(filename, uf.file, { contentType: uf.file.type })

        if (uploadErr) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error' } : f
          ))
          continue
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, progress: 50 } : f
        ))

        // Get image dimensions from preview
        const dims = await getImageDimensions(uf.preview)

        // Call our API route to compress + create web/thumbnail versions
        const res = await fetch('/api/process-image', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            story_id:      story.id,
            original_path: filename,
            caption:       uf.caption || null,
            display_order: i,
            width:         dims.width,
            height:        dims.height,
          }),
        })

        if (!res.ok) {
          // Fall back — store original path directly
          await supabase.from('photographs').insert({
            story_id:      story.id,
            storage_path:  `originals/${filename}`,
            web_path:      `originals/${filename}`,
            thumbnail_path:`originals/${filename}`,
            width:         dims.width,
            height:        dims.height,
            caption:       uf.caption || null,
            display_order: i,
          })
        }

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done', progress: 100 } : f
        ))
      }

      // 3. Invalidate homepage cache
      await supabase
        .from('homepage_layouts')
        .update({ is_active: false })
        .eq('is_active', true)

      router.push('/admin')

    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
      setPublishing(false)
    }
  }

  return (
    <main style={{ padding: '3rem 2.5rem', maxWidth: '860px' }}>
      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{
          fontFamily: 'DM Serif Display, Georgia, serif',
          fontStyle:  'italic',
          fontSize:   '2.2rem',
          color:      '#F2EDE6',
          marginBottom: '0.5rem',
        }}>New Story</h1>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Story Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Morning in Kyoto"
          style={{ ...inputStyle, fontSize: '1.3rem', fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic' }}
        />
      </div>

      {/* Introduction */}
      <div style={{ marginBottom: '2.5rem' }}>
        <label style={labelStyle}>Story Introduction</label>
        <textarea
          value={introduction}
          onChange={e => setIntroduction(e.target.value)}
          placeholder="Write what this story is about. What you saw, what you felt, what you were looking for."
          rows={4}
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.7 }}
        />
      </div>

      {/* Drop zone */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={labelStyle}>Photographs</label>
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => document.getElementById('fileInput')?.click()}
          style={{
            border:        `1px dashed ${draggingOver ? '#E8590C' : 'rgba(255,255,255,0.12)'}`,
            borderRadius:  '8px',
            padding:       '3.5rem 2rem',
            textAlign:     'center',
            cursor:        'pointer',
            background:    draggingOver ? 'rgba(232,89,12,0.05)' : 'transparent',
            transition:    'border-color 0.2s, background 0.2s',
            marginBottom:  '1rem',
          }}
        >
          <p style={{ fontSize: '1.5rem', marginBottom: '0.75rem', opacity: 0.3 }}>⬆</p>
          <p style={{ fontSize: '0.85rem', color: '#F2EDE6', marginBottom: '0.4rem' }}>
            Drop your entire photo folder here
          </p>
          <p style={{ fontSize: '0.72rem', color: '#444' }}>
            or click to browse · JPG, PNG, WEBP, HEIC
          </p>
        </div>
        <input
          id="fileInput"
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <p style={{
            fontSize: '0.65rem', letterSpacing: '0.22em',
            textTransform: 'uppercase', color: '#555', marginBottom: '1rem',
          }}>
            {files.length} photograph{files.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {files.map((uf, i) => (
              <div key={i} style={{
                position:     'relative',
                background:   '#1A1A1A',
                borderRadius: '4px',
                overflow:     'hidden',
                border:       '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uf.preview}
                  alt=""
                  style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block',
                           opacity: uf.status === 'uploading' ? 0.5 : 1 }}
                />
                {/* Status overlay */}
                {uf.status === 'uploading' && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0,
                    height: '2px', background: '#E8590C',
                    width: `${uf.progress}%`, transition: 'width 0.3s',
                  }}/>
                )}
                {uf.status === 'done' && (
                  <div style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#E8590C', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '10px', color: '#111',
                  }}>✓</div>
                )}
                {/* Caption input */}
                <div style={{ padding: '0.6rem' }}>
                  <input
                    type="text"
                    placeholder="Caption (optional)"
                    value={uf.caption}
                    onChange={e => updateCaption(i, e.target.value)}
                    style={{
                      width: '100%', background: 'transparent',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)',
                      color: '#F2EDE6', fontSize: '0.72rem', padding: '4px 0',
                      outline: 'none', fontFamily: 'DM Sans, system-ui, sans-serif',
                    }}
                  />
                </div>
                {/* Remove button */}
                {uf.status !== 'uploading' && (
                  <button
                    onClick={() => removeFile(i)}
                    style={{
                      position: 'absolute', top: '0.4rem', left: '0.4rem',
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'rgba(17,17,17,0.8)', border: 'none',
                      color: '#555', fontSize: '10px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#E8590C' }}>{error}</p>
      )}

      {/* Publish button */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{
            padding:       '12px 32px',
            background:    '#E8590C',
            border:        'none',
            borderRadius:  '4px',
            color:         '#111',
            fontSize:      '0.7rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight:    500,
            cursor:        publishing ? 'not-allowed' : 'pointer',
            opacity:       publishing ? 0.6 : 1,
            transition:    'opacity 0.2s, background 0.2s',
          }}
          onMouseEnter={e => { if (!publishing) e.currentTarget.style.background = '#D44E0A' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#E8590C' }}
        >
          {publishing ? 'Publishing…' : 'Publish Story'}
        </button>
        <a href="/admin" style={{
          fontSize: '0.7rem', letterSpacing: '0.18em',
          textTransform: 'uppercase', color: '#444',
          textDecoration: 'none', transition: 'color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#F2EDE6')}
        onMouseLeave={e => (e.currentTarget.style.color = '#444')}
        >Cancel</a>
      </div>
    </main>
  )
}

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1200, height: 800 })
    img.src = src
  })
}

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      '0.62rem',
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color:         '#E8590C',
  marginBottom:  '0.6rem',
}

const inputStyle: React.CSSProperties = {
  width:        '100%',
  padding:      '12px 14px',
  background:   '#1A1A1A',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: '4px',
  color:        '#F2EDE6',
  fontSize:     '0.9rem',
  fontFamily:   'DM Sans, system-ui, sans-serif',
  outline:      'none',
  fontWeight:   300,
}
