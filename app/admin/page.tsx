'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase, type Photograph } from '@/lib/supabase'
import { adminRequest } from '@/lib/admin-request'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

type PhotoDraft = { tags: string; city: string; country: string; year: string }

const editInputStyle: React.CSSProperties = {
  width: '100%', padding: '.55rem .6rem', color: '#F2EDE6',
  background: '#151515', border: '1px solid rgba(255,255,255,.12)',
  borderRadius: 4, font: 'inherit', fontSize: '.68rem', outline: 'none',
}

export default function AdminDashboard() {
  const [photographs, setPhotographs] = useState<Photograph[]>([])
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoBusy, setLogoBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [editingPhotoId, setEditingPhotoId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<PhotoDraft | null>(null)
  const [savingPhotoId, setSavingPhotoId] = useState<string | null>(null)
  const [editError, setEditError] = useState('')
  const [editMessage, setEditMessage] = useState('')

  const load = useCallback(async () => {
    const [{ data: photos }, { data: settings }] = await Promise.all([
      supabase.from('photographs').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('site_settings').select('logo_path').eq('singleton', true).maybeSingle(),
    ])
    setPhotographs(photos ?? [])
    setLogoPath(settings?.logo_path ?? null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const beginEdit = (photo: Photograph) => {
    setEditingPhotoId(photo.id)
    setEditDraft({
      tags: photo.tags?.join(', ') ?? '',
      city: photo.city ?? '',
      country: photo.country ?? '',
      year: photo.year ? String(photo.year) : '',
    })
    setEditError('')
    setEditMessage('')
  }

  const cancelEdit = () => {
    setEditingPhotoId(null)
    setEditDraft(null)
    setEditError('')
  }

  const savePhotoDetails = async (photo: Photograph) => {
    if (!editDraft || editingPhotoId !== photo.id) return
    const tags = Array.from(new Set(editDraft.tags.split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(Boolean)))
    const city = editDraft.city.trim() || null
    const country = editDraft.country.trim() || null
    const yearValue = editDraft.year.trim()
    const year = yearValue ? Number(yearValue) : null

    if (tags.length > 20 || tags.some(tag => tag.length > 50)) {
      setEditError('Use up to 20 tags, with no tag longer than 50 characters.')
      return
    }
    if ((city && city.length > 120) || (country && country.length > 120)) {
      setEditError('City and country names must be 120 characters or fewer.')
      return
    }
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 9999)) {
      setEditError('Enter a valid four digit year, or leave it blank.')
      return
    }

    setSavingPhotoId(photo.id)
    setEditError('')
    setEditMessage('')
    try {
      const { data: updated, error } = await supabase.from('photographs')
        .update({ tags, city, country, year })
        .eq('id', photo.id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!updated) throw new Error('No photograph was updated. Refresh the page and try again.')

      setPhotographs(previous => previous.map(item => item.id === photo.id
        ? { ...item, tags, city, country, year }
        : item))
      setEditingPhotoId(null)
      setEditDraft(null)
      setEditMessage('Photograph details saved.')
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Could not save photograph details.')
    } finally {
      setSavingPhotoId(null)
    }
  }

  const uploadLogo = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/svg+xml'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage('Choose a transparent PNG or SVG smaller than 5 MB.')
      return
    }
    setLogoBusy(true)
    setMessage('')
    try {
      const extension = file.type === 'image/svg+xml' ? 'svg' : 'png'
      const path = 'sarth-logo-' + crypto.randomUUID() + '.' + extension
      const { error: uploadError } = await supabase.storage.from('brand').upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError
      const { error: saveError } = await supabase.from('site_settings').upsert({ singleton: true, logo_path: 'brand/' + path, updated_at: new Date().toISOString() })
      if (saveError) throw saveError
      if (logoPath?.startsWith('brand/')) {
        const { error: removeError } = await supabase.storage.from('brand').remove([logoPath.slice('brand/'.length)])
        if (removeError) console.error('Could not remove previous logo:', removeError.message)
      }
      setLogoPath('brand/' + path)
      setMessage('Logo saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save logo.')
    } finally { setLogoBusy(false) }
  }

  const deletePhoto = async (photo: Photograph) => {
    if (!confirm('Delete this photograph and its stored files? This cannot be undone.')) return
    try {
      await adminRequest('/api/admin/photographs/' + photo.id, { action: 'delete' })
      await load()
    } catch (error) { alert(error instanceof Error ? error.message : 'Could not delete photograph.') }
  }

  if (loading) return <div style={{ padding: '4rem 2.5rem', color: '#777' }}>Loading…</div>
  return (
    <main style={{ padding: '3rem 2.5rem', maxWidth: 1050 }}>
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic', fontSize: '2.2rem', marginBottom: '.5rem' }}>Photographs</h1>
        <p style={{ fontSize: '.8rem', color: '#777' }}>{photographs.filter(photo => photo.display_target === 'desktop').length} desktop · {photographs.filter(photo => photo.display_target === 'mobile').length} mobile</p>
      </div>

      <section style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,.09)', borderRadius: 6, marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '.82rem', marginBottom: '.45rem' }}>Website logo</h2>
        <p style={{ fontSize: '.72rem', color: '#888', marginBottom: '1rem', lineHeight: 1.6 }}>Recommended: 1200 × 300 px transparent PNG or SVG. It appears at the top centre, displayed up to 240 × 60 px.</p>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          {logoPath && <div style={{ width: 240, height: 60, display: 'grid', placeItems: 'center', background: '#222', borderRadius: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SUPABASE_URL + '/storage/v1/object/public/' + logoPath + '?v=' + encodeURIComponent(logoPath)} alt="Current website logo" style={{ maxWidth: 240, maxHeight: 60, objectFit: 'contain' }} />
          </div>}
          <label style={{ color: '#F2EDE6', fontSize: '.72rem', cursor: 'pointer', border: '1px solid rgba(255,255,255,.18)', borderRadius: 4, padding: '.65rem .85rem', opacity: logoBusy ? .5 : 1 }}>
            {logoBusy ? 'Saving…' : logoPath ? 'Replace logo' : 'Upload logo'}
            <input type="file" accept="image/png,image/svg+xml" disabled={logoBusy} hidden onChange={event => { uploadLogo(event.target.files?.[0]); event.currentTarget.value = '' }} />
          </label>
          {message && <span role="status" style={{ color: '#aaa', fontSize: '.72rem' }}>{message}</span>}
        </div>
      </section>

      {photographs.length === 0 ? <section style={{ padding: '3rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,.1)', color: '#777' }}>
        <p style={{ marginBottom: '1rem', fontSize: '.85rem' }}>No photographs yet.</p><a href="/admin/new" style={{ color: '#E8590C', fontSize: '.7rem', letterSpacing: '.15em', textTransform: 'uppercase' }}>Add photographs →</a>
      </section> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '1rem' }}>
        {photographs.map(photo => {
          const isEditing = editingPhotoId === photo.id && editDraft !== null
          const isSaving = savingPhotoId === photo.id
          const fieldLabel = 'for photograph ' + photo.id.slice(0, 8)
          return <article key={photo.id} style={{ position: 'relative', border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, overflow: 'hidden', background: '#191919' }}>
            {photo.web_path && <img src={SUPABASE_URL + '/storage/v1/object/public/' + photo.web_path} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />}
            <span style={{ position: 'absolute', top: 8, left: 8, padding: '.25rem .4rem', borderRadius: 3, background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: '.6rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>{photo.display_target}</span>
            <div style={{ padding: '.7rem', minHeight: 64 }}>
              {isEditing && editDraft ? <>
                <input placeholder="Tags, separated by commas" aria-label={'Tags ' + fieldLabel} value={editDraft.tags} disabled={isSaving} onChange={event => setEditDraft({ ...editDraft, tags: event.target.value })} style={{ ...editInputStyle, marginBottom: '.45rem' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.45rem', marginBottom: '.45rem' }}>
                  <input placeholder="City" aria-label={'City ' + fieldLabel} value={editDraft.city} disabled={isSaving} onChange={event => setEditDraft({ ...editDraft, city: event.target.value })} style={editInputStyle} />
                  <input placeholder="Country" aria-label={'Country ' + fieldLabel} value={editDraft.country} disabled={isSaving} onChange={event => setEditDraft({ ...editDraft, country: event.target.value })} style={editInputStyle} />
                </div>
                <input placeholder="Year" aria-label={'Year ' + fieldLabel} inputMode="numeric" maxLength={4} value={editDraft.year} disabled={isSaving} onChange={event => setEditDraft({ ...editDraft, year: event.target.value.replace(/\D/g, '') })} style={{ ...editInputStyle, marginBottom: '.55rem' }} />
                {editError && <p role="alert" style={{ color: '#ff8b72', fontSize: '.65rem', marginBottom: '.45rem' }}>{editError}</p>}
                <div style={{ display: 'flex', gap: '.4rem' }}>
                  <button type="button" onClick={() => savePhotoDetails(photo)} disabled={isSaving} style={{ flex: 1, padding: '.45rem .3rem', borderRadius: 3, background: '#E8590C', color: '#111', fontSize: '.62rem', cursor: 'pointer', opacity: isSaving ? .5 : 1 }}>{isSaving ? 'Saving…' : 'Save'}</button>
                  <button type="button" onClick={cancelEdit} disabled={isSaving} style={{ padding: '.45rem .5rem', border: '1px solid rgba(255,255,255,.16)', borderRadius: 3, color: '#ccc', fontSize: '.62rem', cursor: 'pointer' }}>Cancel</button>
                </div>
              </> : <>
                <p style={{ fontSize: '.72rem', color: '#eee' }}>{[photo.city, photo.country, photo.year].filter(Boolean).join(', ') || 'No location details'}</p>
                <p style={{ marginTop: '.35rem', fontSize: '.65rem', color: '#888', wordBreak: 'break-word' }}>{photo.tags?.join(', ') || 'No tags'}</p>
                <button type="button" onClick={() => beginEdit(photo)} disabled={editingPhotoId !== null} style={{ marginTop: '.55rem', padding: '.4rem .55rem', border: '1px solid rgba(255,255,255,.16)', borderRadius: 3, color: '#ddd', fontSize: '.62rem', cursor: 'pointer', opacity: editingPhotoId !== null ? .5 : 1 }}>Edit details</button>
              </>}
            </div>
            {!isEditing && <button type="button" onClick={() => deletePhoto(photo)} title="Delete photograph" aria-label="Delete photograph" style={{ position: 'absolute', top: 7, right: 7, width: 27, height: 27, borderRadius: '50%', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer' }}>×</button>}
          </article>
        })}
      </div>}

      {editMessage && <p role="status" style={{ color: '#a8d7aa', fontSize: '.72rem', marginTop: '1rem' }}>{editMessage}</p>}
    </main>
  )
}
