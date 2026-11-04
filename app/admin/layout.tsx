'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    document.body.classList.add('scrollable')
    return () => document.body.classList.remove('scrollable')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && pathname !== '/admin/login') {
        router.push('/admin/login')
      } else {
        setChecking(false)
      }
    })
  }, [router, pathname])

  if (checking && pathname !== '/admin/login') {
    return (
      <div style={{
        minHeight: '100vh', background: '#111111',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="wordmark" style={{ fontSize: '2rem', opacity: 0.3 }}>Sārth</span>
      </div>
    )
  }

  return (
    <div style={{
      minHeight:   '100vh',
      background:  '#111111',
      fontFamily:  'DM Sans, system-ui, sans-serif',
      color:       '#F2EDE6',
    }}>
      {pathname !== '/admin/login' && (
        <header style={{
          position:     'sticky',
          top:          0,
          zIndex:       100,
          padding:      '1.2rem 2.5rem',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'space-between',
          background:   'rgba(17,17,17,0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span className="wordmark" style={{ fontSize: '1.3rem' }}>Sārth</span>
          <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <a href="/admin" style={{
              fontSize: '0.72rem', letterSpacing: '0.18em',
              textTransform: 'uppercase', color: '#555',
              textDecoration: 'none', transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F2EDE6')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >Stories</a>
            <a href="/admin/new" style={{
              fontSize: '0.72rem', letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '6px 14px',
              background: '#E8590C',
              color: '#111',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#D44E0A')}
            onMouseLeave={e => (e.currentTarget.style.background = '#E8590C')}
            >+ New Story</a>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/admin/login'
              }}
              style={{
                fontSize: '0.65rem', letterSpacing: '0.18em',
                textTransform: 'uppercase', color: '#444',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >Sign out</button>
          </nav>
        </header>
      )}
      {children}
    </div>
  )
}
