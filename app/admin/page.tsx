'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase, Photograph } from '@/lib/supabase'
import { adminRequest } from '@/lib/admin-request'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

export default function AdminDashboard() {
  const [photographs, setPhotographs] = useState<Photograph[]>([])
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [logoBusy, setLogoBusy] = useState(false)
  const [message, setMessage] = useState('')

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
      const path = `sarth-logo-${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('brand').upload(path, file, { contentType: file.type, upsert: true })
      if (uploadError) throw uploadError
      const { error: saveError } = await supabase.from('site_settings').upsert({ singleton: true, logo_path: `brand/${path}`, updated_at: new Date().toISOString() })
      if (saveError) throw saveError
      if (logoPath?.startsWith('brand/')) {
        const { error: removeError } = await supabase.storage.from('brand').remove([logoPath.slice('brand/'.length)])
        if (removeError) console.error('Could not remove previous logo:', removeError.message)
      }
      setLogoPath(`brand/${path}`)
      setMessage('Logo saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save logo.')
    } finally { setLogoBusy(false) }
  }

  const deletePhoto = async (photo: Photograph) => {
    if (!confirm('Delete this photograph and its stored files? This cannot be undone.')) return
    try {
      await adminRequest(`/api/admin/photographs/${photo.id}`, { action: 'delete' })
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
            <img src={`${SUPABASE_URL}/storage/v1/object/public/${logoPath}?v=${encodeURIComponent(logoPath)}`} alt="Current website logo" style={{ maxWidth: 240, maxHeight: 60, objectFit: 'contain' }} />
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
        {photographs.map(photo => <article key={photo.id} style={{ position: 'relative', border: '1px solid rgba(255,255,255,.08)', borderRadius: 5, overflow: 'hidden', background: '#191919' }}>
          {photo.web_path && <img src={`${SUPABASE_URL}/storage/v1/object/public/${photo.web_path}`} alt="" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />}
          <span style={{ position: 'absolute', top: 8, left: 8, padding: '.25rem .4rem', borderRadius: 3, background: 'rgba(0,0,0,.72)', color: '#fff', fontSize: '.6rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>{photo.display_target}</span>
          <div style={{ padding: '.7rem', minHeight: 64 }}>
            <p style={{ fontSize: '.72rem', color: '#eee' }}>{[photo.city, photo.country, photo.year].filter(Boolean).join(', ') || 'No location details'}</p>
            <p style={{ marginTop: '.35rem', fontSize: '.65rem', color: '#888' }}>{photo.tags?.join(', ') || 'No tags'}</p>
          </div>
          <button onClick={() => deletePhoto(photo)} title="Delete photograph" aria-label="Delete photograph" style={{ position: 'absolute', top: 7, right: 7, width: 27, height: 27, borderRadius: '50%', background: 'rgba(0,0,0,.7)', color: '#fff', cursor: 'pointer' }}>×</button>
        </article>)}
      </div>}
    </main>
  )
}
