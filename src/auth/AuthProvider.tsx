import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { db } from '../lib/api'
import type { SignUpInput } from '../lib/db'
import type { Profile, ProfilePatch } from '../lib/types'
import { isAdminEmail } from '../lib/config'

interface AuthCtx {
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (patch: ProfilePatch) => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.getCurrentProfile()
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const p = await db.signIn(email, password)
    setProfile(p)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const p = await db.signUp(input)
    setProfile(p)
  }, [])

  const signOut = useCallback(async () => {
    await db.signOut()
    setProfile(null)
  }, [])

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      const current = await db.getCurrentProfile()
      if (!current) return
      const updated = await db.updateMyProfile(current.id, patch)
      setProfile(updated)
    },
    [],
  )

  const isAdmin = profile?.role === 'admin' || isAdminEmail(profile?.email)

  return (
    <Ctx.Provider value={{ profile, loading, isAdmin, signIn, signUp, signOut, updateProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
