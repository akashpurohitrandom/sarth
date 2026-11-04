'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    const { data: userData } = await supabase.auth.getUser()
    const { data: admin } = await supabase.from('admin_users').select('user_id')
      .eq('user_id', userData.user?.id || '').maybeSingle()
    if (!admin) {
      await supabase.auth.signOut()
      setError('This account does not have administrator access.')
      setLoading(false)
      return
    }
    router.push('/admin')
  }

  return (
    <div style={{
      minHeight:       '100vh',
      background:      '#111111',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      fontFamily:      'DM Sans, system-ui, sans-serif',
    }}>
      <form onSubmit={handleLogin} style={{
        width:         '100%',
        maxWidth:      '360px',
        padding:       '0 2rem',
      }}>
        <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <span className="wordmark" style={{ fontSize: '2rem' }}>Sārth</span>
          <p style={{
            marginTop:     '0.5rem',
            fontSize:      '0.65rem',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color:         '#555',
          }}>Admin</p>
        </div>

        {error && (
          <p style={{
            marginBottom: '1rem',
            fontSize:     '0.8rem',
            color:        '#E8590C',
            textAlign:    'center',
          }}>{error}</p>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width:         '100%',
            padding:       '12px',
            background:    '#E8590C',
            border:        'none',
            borderRadius:  '4px',
            color:         '#111',
            fontSize:      '0.7rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight:    500,
            cursor:        'pointer',
            opacity:       loading ? 0.6 : 1,
            transition:    'opacity 0.2s',
          }}
        >
          {loading ? 'Signing in…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width:         '100%',
  padding:       '12px 14px',
  background:    '#1A1A1A',
  border:        '1px solid rgba(255,255,255,0.08)',
  borderRadius:  '4px',
  color:         '#F2EDE6',
  fontSize:      '0.9rem',
  fontFamily:    'DM Sans, system-ui, sans-serif',
  outline:       'none',
}
