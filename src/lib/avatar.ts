import { config } from './config'
import { supabase } from './supabase'

/** Faz upload da foto de perfil e retorna a URL publica (ou dataURL no modo demo). */
export async function uploadAvatar(userId: string, file: Blob): Promise<string | null> {
  if (config.mockMode) {
    return await new Promise((resolve) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => resolve(null)
      r.readAsDataURL(file)
    })
  }
  if (!supabase) return null
  const path = `${userId}/${Date.now()}.jpg`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true })
  if (error) return null
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}
