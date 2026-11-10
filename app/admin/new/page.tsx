'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { adminRequest } from '@/lib/admin-request'

type DisplayTarget = 'desktop' | 'mobile'
type MetadataField = 'tags' | 'city' | 'country' | 'year'
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
type FailedUpload = {
  id: string
  name: string
  target: DisplayTarget
  reason: string
}
type Suggestions = { tags: string[]; cities: string[]; countries: string[]; years: string[] }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.65rem 0.75rem', color: '#F2EDE6',
  background: '#151515', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '4px', font: 'inherit', fontSize: '0.76rem', outline: 'none',
}

const panels: { target: DisplayTarget; title: string; description: string }[] = [
  { target: 'desktop', title: 'Desktop view', description: 'Shown on screens wider than 700 px. Existing photographs stay in this collection.' },
  { target: 'mobile', title: 'Mobile view', description: 'Shown on screens 700 px wide and below. These photographs appear only in the mobile view.' },
]

const emptySuggestions: Suggestions = { tags: [], cities: [], countries: [], years: [] }
const suggestionLimit = 8

export default function NewPhotographsPage() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragging, setDragging] = useState<DisplayTarget | null>(null)
  const [savingTarget, setSavingTarget] = useState<DisplayTarget | null>(null)
  const [savedSuggestions, setSavedSuggestions] = useState<Suggestions>(emptySuggestions)
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    const loadSuggestions = async () => {
      try {
        const { data, error: queryError } = await supabase.from('photographs')
          .select('tags, city, country, year')
          .not('web_path', 'is', null)
          .order('created_at', { ascending: false })
          .limit(500)

        if (!active || queryError || !data) return
        const unique = (values: Array<string | number | null | undefined>) =>
          Array.from(new Set(values.map(value => String(value ?? '').trim()).filter(Boolean)))
            .slice(0, suggestionLimit)

        setSavedSuggestions({
          tags: unique(data.flatMap(photo => photo.tags ?? [])),
          cities: unique(data.map(photo => photo.city)),
          countries: unique(data.map(photo => photo.country)),
          years: unique(data.map(photo => photo.year)),
        })
      } catch {
        // Suggestions are optional; uploads remain available if they cannot be loaded.
      }
    }

    void loadSuggestions()
    return () => { active = false }
  }, [])

  const suggestions = useMemo(() => {
    const unique = (values: Array<string | number | null | undefined>) => {
      const seen = new Set<string>()
      const result: string[] = []
      for (const raw of values) {
        const value = String(raw ?? '').trim()
        const key = value.toLocaleLowerCase()
        if (!value || seen.has(key)) continue
        seen.add(key)
        result.push(value)
        if (result.length === suggestionLimit) break
      }
      return result
    }

    const draftFiles = files
    return {
      tags: unique([
        ...draftFiles.flatMap(file => file.tags.split(',').map(tag => tag.trim()).filter(Boolean)),
        ...savedSuggestions.tags,
      ]),
      cities: unique([...draftFiles.map(file => file.city), ...savedSuggestions.cities]),
      countries: unique([...draftFiles.map(file => file.country), ...savedSuggestions.countries]),
      years: unique([...draftFiles.map(file => file.year), ...savedSuggestions.years]),
    }
  }, [files, savedSuggestions])

  const addFiles = useCallback((incoming: FileList | File[], target: DisplayTarget) => {
    if (savingTarget) return
    const candidates = Array.from(incoming)
    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const validFiles = candidates.filter(file => acceptedTypes.includes(file.type) && file.size <= 50 * 1024 * 1024)
    const rejectedFiles = candidates.filter(file => !acceptedTypes.includes(file.type) || file.size > 50 * 1024 * 1024)

    if (rejectedFiles.length) {
      setFailedUploads(previous => [...previous, ...rejectedFiles.map(file => ({
        id: crypto.randomUUID(),
        name: file.name,
        target,
        reason: 'Use JPEG, PNG, or WebP files under 50 MB.',
      }))])
      setError('Some files could not be added. See the failed file list below.')
    } else {
      setError('')
    }

    if (!validFiles.length) return
    setMessage('')
    setFiles(previous => [...previous, ...validFiles.map(file => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), target,
      tags: '', city: '', country: '', year: '', status: 'pending' as const,
    }))])
  }, [savingTarget])

  const update = (id: string, field: MetadataField, value: string) => {
    setFiles(previous => previous.map(file => file.id === id ? { ...file, [field]: value } : file))
  }

  const applySuggestion = (id: string, field: MetadataField, value: string) => {
    setFiles(previous => previous.map(file => {
      if (file.id !== id) return file
      if (field === 'tags') {
        const tags = file.tags.split(',').map(tag => tag.trim()).filter(Boolean)
        if (!tags.some(tag => tag.toLowerCase() === value.toLowerCase())) tags.push(value)
        return { ...file, tags: tags.join(', ') }
      }
      return { ...file, [field]: value }
    }))
  }

  const upload = async (target: DisplayTarget) => {
    const batch = files.filter(file => file.target === target && file.status !== 'done')
    if (!batch.length) { setError('Choose photographs in the ' + target + ' panel first.'); return }
    setSavingTarget(target)
    setError('')
    setMessage('')
    setFailedUploads(previous => previous.filter(failure => !batch.some(file => file.id === failure.id)))
    const failures: FailedUpload[] = []

    for (const item of batch) {
      const tags = item.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      const year = item.year.trim() ? Number(item.year) : null
      if (tags.length > 20 || tags.some(tag => tag.length > 50)) {
        failures.push({ id: item.id, name: item.file.name, target, reason: 'Maximum 20 tags; each tag must be 50 characters or fewer.' })
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        continue
      }
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 9999)) {
        failures.push({ id: item.id, name: item.file.name, target, reason: 'Enter a valid four digit year.' })
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
        continue
      }

      setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'uploading' } : file))
      try {
        const extension = item.file.type === 'image/png' ? 'png' : item.file.type === 'image/webp' ? 'webp' : 'jpg'
        const originalPath = item.id + '/' + item.id + '.' + extension
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
        const reason = uploadFailure instanceof Error ? uploadFailure.message : 'Unexpected upload error.'
        failures.push({ id: item.id, name: item.file.name, target, reason })
        setFiles(previous => previous.map(file => file.id === item.id ? { ...file, status: 'error' } : file))
      }
    }

    setSavingTarget(null)
    if (failures.length) {
      setFailedUploads(previous => [...previous, ...failures])
      setError(failures.length + ' upload(s) failed. See the failed file list below.')
    } else {
      setMessage(batch.length + ' ' + target + ' photograph(s) saved.')
    }
  }

  const suggestionGroups: { field: MetadataField; label: string; values: string[] }[] = [
    { field: 'tags', label: 'Tags', values: suggestions.tags },
    { field: 'city', label: 'Cities', values: suggestions.cities },
    { field: 'country', label: 'Countries', values: suggestions.countries },
    { field: 'year', label: 'Years', values: suggestions.years },
  ]

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
          const inputId = 'photo-files-' + target
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
                aria-label={'Upload ' + target + ' photographs'}
                style={{ border: '1px dashed ' + (dragging === target ? '#E8590C' : 'rgba(255,255,255,.18)'), borderRadius: 6, padding: '2rem 1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '1rem' }}>
                <p style={{ fontSize: '.82rem', marginBottom: '.4rem' }}>Drop {target} photographs here or click to browse</p>
                <p style={{ fontSize: '.7rem', color: '#666' }}>JPEG, PNG, WebP · up to 50 MB each</p>
                <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={savingTarget !== null} onChange={event => { if (event.target.files) addFiles(event.target.files, target); event.currentTarget.value = '' }} />
              </div>

              {targetFiles.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '.75rem' }}>
                {targetFiles.map((file, index) => <article key={file.id} style={{ position: 'relative', border: '1px solid rgba(255,255,255,.09)', borderRadius: 6, overflow: 'hidden', background: '#1a1a1a' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={file.preview} alt={target + ' upload preview ' + (index + 1)} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                  <div style={{ padding: '.7rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem' }}>
                    <input placeholder="Tags, separated by commas" aria-label={title + ' photo ' + (index + 1) + ' tags'} value={file.tags} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'tags', event.target.value)} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                    <input placeholder="City" aria-label={title + ' photo ' + (index + 1) + ' city'} value={file.city} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'city', event.target.value)} style={inputStyle} />
                    <input placeholder="Country" aria-label={title + ' photo ' + (index + 1) + ' country'} value={file.country} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'country', event.target.value)} style={inputStyle} />
                    <input placeholder="Year" aria-label={title + ' photo ' + (index + 1) + ' year'} inputMode="numeric" maxLength={4} value={file.year} disabled={savingTarget !== null || file.status === 'done'} onChange={event => update(file.id, 'year', event.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                  </div>

                  {suggestionGroups.some(group => group.values.length > 0) && <div style={{ padding: '0 .7rem .8rem', display: 'grid', gap: '.55rem' }}>
                    {suggestionGroups.map(({ field, label, values }) => values.length > 0 && <div key={field}>
                      <p style={{ fontSize: '.62rem', color: '#888', marginBottom: '.3rem' }}>{label} suggestions</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.3rem' }}>
                        {values.map(value => {
                          const selected = field === 'tags'
                            ? file.tags.split(',').some(tag => tag.trim().toLowerCase() === value.toLowerCase())
                            : file[field].trim().toLowerCase() === value.toLowerCase()
                          return <button key={value} type="button" disabled={savingTarget !== null || file.status === 'done' || selected}
                            aria-label={'Use ' + value + ' as ' + field}
                            aria-pressed={selected}
                            onClick={() => applySuggestion(file.id, field, value)}
                            style={{ padding: '.22rem .42rem', border: '1px solid rgba(255,255,255,.14)', borderRadius: 99, color: selected ? '#E8590C' : '#ccc', background: selected ? 'rgba(232,89,12,.12)' : 'transparent', fontSize: '.62rem', cursor: selected ? 'default' : 'pointer', opacity: savingTarget !== null || file.status === 'done' ? .5 : 1 }}>
                            {value}
                          </button>
                        })}
                      </div>
                    </div>)}
                  </div>}

                  {!savingTarget && file.status !== 'done' && <button type="button" onClick={() => setFiles(previous => previous.filter(item => item.id !== file.id))} aria-label={'Remove ' + target + ' photo ' + (index + 1)} style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', color: '#fff', background: 'rgba(0,0,0,.65)', cursor: 'pointer' }}>×</button>}
                  <span style={{ position: 'absolute', top: 9, left: 10, fontSize: '.68rem', color: file.status === 'error' ? '#ff7b64' : '#fff', textShadow: '0 1px 4px #000' }}>{file.status === 'done' ? 'Saved' : file.status === 'uploading' ? 'Uploading…' : file.status === 'error' ? 'Error' : ''}</span>
                </article>)}
              </div>}

              <button type="button" onClick={() => upload(target)} disabled={savingTarget !== null || pendingCount === 0} style={{ marginTop: '1rem', background: '#E8590C', color: '#111', padding: '.75rem 1rem', borderRadius: 4, fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: savingTarget !== null || pendingCount === 0 ? .5 : 1 }}>
                {savingTarget === target ? 'Uploading ' + target + '…' : 'Upload ' + target + ' photographs'}
              </button>
            </section>
          )
        })}
      </div>

      {error && <p role="alert" style={{ color: '#ff8b72', fontSize: '.78rem', marginTop: '1.25rem' }}>{error}</p>}
      {message && <p role="status" style={{ color: '#a8d7aa', fontSize: '.78rem', marginTop: '1.25rem' }}>{message}</p>}
      {failedUploads.length > 0 && <section aria-live="polite" style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid rgba(255,123,100,.35)', borderRadius: 6, background: 'rgba(255,123,100,.06)' }}>
        <h2 style={{ fontSize: '.82rem', color: '#ff9a85', marginBottom: '.6rem' }}>Files that failed</h2>
        <ul style={{ paddingLeft: '1.2rem', color: '#ddd', fontSize: '.72rem', lineHeight: 1.7 }}>
          {failedUploads.map(failure => <li key={failure.id}><strong>{failure.name}</strong> ({failure.target}) — {failure.reason}</li>)}
        </ul>
      </section>}
      <button type="button" onClick={() => router.push('/admin')} style={{ color: '#aaa', padding: '.75rem 0', marginTop: '.5rem', cursor: 'pointer' }}>Back to photographs</button>
    </main>
  )
}
