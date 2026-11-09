'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { adminRequest } from '@/lib/admin-request'

type DisplayTarget = 'desktop' | 'mobile'
type UploadFile = {
  id: string
  file: File
  preview: string
  target: DisplayTarget
  tags: string
  city: string
  country: string
  year: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.75rem', color: '#F2EDE6',
  background: '#151515', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px', font: 'inherit', fontSize: '0.76rem', outline: 'none',
}

const panels: { target: DisplayTarget; title: string; description: string }[] = [
  { target: 'desktop', title: 'Desktop view', description: 'Shown on screens wider than 700 px. Existing photographs stay in this collection.' },
  { target: 'mobile', title: 'Mobile view', description: 'Shown on screens 700 px wide and below. These photographs appear only in the mobile view.' },
]

export default function NewPhotographsPage() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragging, setDragging] = useState<DisplayTarget | null>(null)
  const [savingTarget, setSavingTarget] = useState<DisplayTarget | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const addFiles = useCallback((incoming: FileList | File[], target: DisplayTarget) => {
    if (savingTarget) return
    const candidates = Array.from(incoming)
    if (candidates.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 50 * 1024 * 1024)) {
      setError('Use JPEG, PNG, or WebP files under 50 MB.')
      return
    }
    setError('')
    setMessage('')
    setFiles(previous => [...previous, ...candidates.map(file => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), target,
      tags: '', city: '', country: '', year: '', status: 'pending' as const,
    }))])
  }, [savingTarget])

  const update = (id: string, field: 'tags' | 'city' | 'country' | 'year', value: string) => {
    setFiles(previous => previous.map(file => file.id === id ? { ...file, [field]: value } : file))
  }

  const upload = async (target: DisplayTarget) => {
    const batch = files.filter(file => file.target === target && file.status !== 'done')
    if (!batch.length) { setError(`Choose photographs in the ${target} panel first.`); return }
    setSavingTarget(target)
    setError('')
    setMessage('')
    let failed = 0
    for (const item of batch) {
      const tags = item.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      const year = item.year.trim() ? Number(item.year) : null
      if (tags.length > 20 || tags.some(tag => tag.length > 50)) {
        failed++
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        setError('Each photograph can have up to 20 tags, with no tag longer than 50 characters.')
        continue
      }
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 9999)) {
        failed++
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        setError('Enter a valid four digit year.')
        continue
      }
      setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'uploading' } : file))
      try {
        const extension = item.file.type === 'image/png' ? 'png' : item.file.type === 'image/webp' ? 'webp' : 'jpg'
        const originalPath = `${item.id}/${item.id}.${extension}`
        const { error: uploadError } = await supabase.storage.from('originals')
          .upload(originalPath, item.file, { contentType: item.file.type, upsert: true })
        if (uploadError) throw uploadError
        await adminRequest('/api/process-image', {
          photograph_id: item.id,
          original_path: originalPath,
          tags,
          city: item.city.trim() || null,
          country: item.country.trim() || null,
          year,
          display_target: target,
        })
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'done' } : file))
      } catch (uploadFailure) {
        failed++
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        if (uploadFailure instanceof Error) setError(uploadFailure.message)
      }
    }
    setSavingTarget(null)
    if (failed) setError(`${failed} upload(s) failed. Correct any invalid details and retry.`)
    else setMessage(`${batch.length} ${target} photograph(s) saved.`)
  }

  return (
    <main style={{ padding: '3rem 2.5rem', maxWidth: 1120 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic', fontSize: '2.2rem', marginBottom: '.5rem' }}>Add photographs</h1>
        <p style={{ fontSize: '.8rem', color: '#777' }}>Choose the display panel for each photograph. Desktop and mobile galleries are managed separately.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.25rem' }}>
        {panels.map(({ target, title, description }) => {
          const targetFiles = files.filter(file => file.target === target)
          const pendingCount = targetFiles.filter(file => file.status !== 'done').length
          const inputId = `photo-files-${target}`
          return (
            <section key={target} style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,.1)', borderRadius: 7, background: '#141414' }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '.4rem' }}>{title}</h2>
              <p style={{ fontSize: '.72rem', lineHeight: 1.5, color: '#888', marginBottom: '1rem' }}>{description}</p>

              <div
                onDragOver={event => { event.preventDefault(); setDragging(target) }}
                onDragLeave={() => setDragging(current => current === target ? null : current)}
                onDrop={event => { event.preventDefault(); setDragging(null); addFiles(event.dataTransfer.files, target) }}
                onClick={event => { if (!(event.target instanceof HTMLInputElement)) document.getElementById(inputId)?.click() }}
                onKeyDown={event => {
                  if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) {
                    event.preventDefault()
                    document.getElementById(inputId)?.click()
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Upload ${target} photographs`}
                style={{ border: `1px dashed ${dragging === target ? '#E8590C' : 'rgba(255,255,255,.18)'}`, borderRadius: 6, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' }}>
                <p style={{ fontSize: '.82rem', marginBottom: '.4rem' }}>Drop {target} photographs here or click to browse</p>
                <p style={{ fontSize: '.7rem', color: '#666' }}>JPEG, PNG, WebP · up to 50 MB each</p>
                <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={savingTarget !== null} onChange={event => { if (event.target.files) addFiles(event.target.files, target); event.currentTarget.value = '' }} />
              </div>

              {targetFiles.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '.75rem' }}>
                {targetFiles.map((file, index) => <article key={file.id} style={{ position: 'relative', border: '1px solid rgba(255,255,255,.09)', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.preview} alt={`${target} upload preview ${index + 1}`} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                  <div style={{ padding: '.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem' }}>
                    <input placeholder="Tags, separated by commas" aria-label={`${title} photo ${index + 1} tags`} value={file.tags} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'tags', event.target.value)} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                    <input placeholder="City" aria-label={`${title} photo ${index + 1} city`} value={file.city} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'city', event.target.value)} style={inputStyle} />
                    <input placeholder="Country" aria-label={`${title} photo ${index + 1} country`} value={file.country} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'country', event.target.value)} style={inputStyle} />
                    <input placeholder="Year" aria-label={`${title} photo ${index + 1} year`} inputMode="numeric" maxLength={4} value={file.year} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'year', event.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                  </div>
                  {!savingTarget && file.status !== 'done' && <button onClick={() => setFiles(previous => previous.filter(item => item.id !== file.id))} aria-label={`Remove ${target} photo ${index + 1}`} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', color: '#fff', background: 'rgba(0,0,0,.65)', cursor: 'pointer' }}>×</button>}
                  <span style={{ position: 'absolute', top: 9, left: 10, fontSize: '.68rem', color: file.status === 'error' ? '#ff7b64' : '#fff', textShadow: '0 1px 4px #000' }}>{file.status === 'done' ? 'Saved' : file.status === 'uploading' ? 'Uploading…' : file.status === 'error' ? 'Error' : ''}</span>
                </article>)}
              </div>}

              <button onClick={() => upload(target)} disabled={savingTarget !== null || pendingCount === 0} style={{ marginTop: '1rem', background: '#E8590C', color: '#111', padding: '.75rem 1rem', borderRadius: 4, fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: savingTarget !== null || pendingCount === 0 ? .5 : 1 }}>
                {savingTarget === target ? `Uploading ${target}…` : `Upload ${target} photographs`}
              </button>
            </section>
          )
        })}
      </div>

      {error && <p role="alert" style={{ color: '#ff8b72', fontSize: '.78rem', marginTop: '1.25rem' }}>{error}</p>}
      {message && <p role="status" style={{ color: '#a8d7aa', fontSize: '.78rem', marginTop: '1.25rem' }}>{message}</p>}
      <button onClick={() => router.push('/admin')} style={{ color: '#aaa', padding: '.75rem 0', marginTop: '.5rem', cursor: 'pointer' }}>Back to photographs</button>
    </main>
  )
}
