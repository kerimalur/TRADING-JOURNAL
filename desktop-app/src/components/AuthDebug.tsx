import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function AuthDebug() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Check beim Laden
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      console.log("Aktueller User:", user)
    })

    // 2. Listener für Änderungen (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      console.log("Auth Status geändert:", session?.user)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div style={{background: 'yellow', padding: 10}}>Lade Auth-Status...</div>

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      background: user ? 'green' : 'red',
      color: 'white',
      padding: '10px',
      zIndex: 9999,
      fontWeight: 'bold'
    }}>
      {user ? `Eingeloggt als: ${user.email}` : 'NICHT EINGELOGGT (Anonym)'}
    </div>
  )
}
