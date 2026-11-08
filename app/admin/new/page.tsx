'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { adminRequest } from '@/lib/admin-request'

type UploadFile = {
  id: string
  file: File
  preview: string
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

export default function NewPhotographsPage() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addFiles = useCallback((incoming: FileList | File[]) => {
    if (saving) return
    const candidates = Array.from(incoming)
    if (candidates.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 50 * 1024 * 1024)) {
      setError('Use JPEG, PNG, or WebP files under 50 MB.')
      return
    }
    setError('')
    setFiles(previous => [...previous, ...candidates.map(file => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file),
      tags: '', city: '', country: '', year: '', status: 'pending' as const,
    }))])
  }, [saving])

  const update = (id: string, field: 'tags' | 'city' | 'country' | 'year', value: string) => {
    setFiles(previous => previous.map(file => file.id === id ? { ...file, [field]: value } : file))
  }

  const upload = async () => {
    if (!files.length) { setError('Choose at least one photograph.'); return }
    setSaving(true)
    setError('')
    let failed = 0
    for (const item of files) {
      if (item.status === 'done') continue
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
        })
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'done' } : file))
      } catch (uploadFailure) {
        failed++
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        if (uploadFailure instanceof Error) setError(uploadFailure.message)
      }
    }
    setSaving(false)
    if (failed) setError(`${failed} upload(s) failed. Correct any invalid details and retry.`)
    else router.push('/admin')
  }

  return (
    <main style={{ padding: '3rem 2.5rem', maxWidth: 980 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic', fontSize: '2.2rem', marginBottom: '.5rem' }}>Add photographs</h1>
        <p style={{ fontSize: '.8rem', color: '#777' }}>Each photograph stands on its own. Add comma-separated tags and its location.</p>
      </div>

      <div onDragOver={event => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }}
        onClick={() => document.getElementById('photo-files')?.click()}
        style={{ border: `1px dashed ${dragging ? '#E8590C' : 'rgba(255,255,255,.18)'}`, borderRadius: 8, padding: '3rem 1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1.5rem' }}>
        <p style={{ fontSize: '.86rem', marginBottom: '.5rem' }}>Drop photographs here or click to browse</p>
        <p style={{ fontSize: '.72rem', color: '#666' }}>JPEG, PNG, WebP · up to 50 MB each</p>
        <input id="photo-files" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event => event.target.files && addFiles(event.target.files)} />
      </div>

      {files.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))', gap: '1rem' }}>
        {files.map((file, index) => <article key={file.id} style={{ position: 'relative', border: '1px solid rgba(255,255,255,.09)', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.preview} alt={`Upload preview ${index + 1}`} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
          <div style={{ padding: '.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem' }}>
            <input placeholder="Tags, separated by commas" aria-label={`Photo ${index + 1} tags`} value={file.tags} disabled={saving || file.status === 'done'} onChange={event => update(file.id, 'tags', event.target.value)} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            <input placeholder="City" aria-label={`Photo ${index + 1} city`} value={file.city} disabled={saving || file.status === 'done'} onChange={event => update(file.id, 'city', event.target.value)} style={inputStyle} />
            <input placeholder="Country" aria-label={`Photo ${index + 1} country`} value={file.country} disabled={saving || file.status === 'done'} onChange={event => update(file.id, 'country', event.target.value)} style={inputStyle} />
            <input placeholder="Year" aria-label={`Photo ${index + 1} year`} inputMode="numeric" maxLength={4} value={file.year} disabled={saving || file.status === 'done'} onChange={event => update(file.id, 'year', event.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
          </div>
          {!saving && file.status !== 'done' && <button onClick={() => setFiles(previous => previous.filter(item => item.id !== file.id))} aria-label={`Remove photo ${index + 1}`} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', color: '#fff', background: 'rgba(0,0,0,.65)', cursor: 'pointer' }}>×</button>}
          <span style={{ position: 'absolute', top: 9, left: 10, fontSize: '.68rem', color: file.status === 'error' ? '#ff7b64' : '#fff', textShadow: '0 1px 4px #000' }}>{file.status === 'done' ? 'Saved' : file.status === 'uploading' ? 'Uploading…' : file.status === 'error' ? 'Error' : ''}</span>
        </article>)}
      </div>}

      {error && <p role="alert" style={{ color: '#ff8b72', fontSize: '.78rem', marginTop: '1.25rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button onClick={upload} disabled={saving || !files.some(file => file.status !== 'done')} style={{ background: '#E8590C', color: '#111', padding: '.75rem 1rem', borderRadius: 4, fontSize: '.72rem', letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? .6 : 1 }}>{saving ? 'Uploading…' : 'Upload photographs'}</button>
        <button onClick={() => router.push('/admin')} style={{ color: '#aaa', padding: '.75rem', cursor: 'pointer' }}>Cancel</button>
      </div>
    </main>
  )
}
