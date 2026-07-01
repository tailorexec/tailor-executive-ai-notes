// Armazenamento das gravacoes de audio.
//   - Modo real  : Supabase Storage (bucket privado "recordings"), com URL assinada.
//   - Modo demo  : IndexedDB do navegador (persiste entre recarregamentos, sem backend).
// A nota guarda apenas uma REFERENCIA (audio_url); o binario fica no armazenamento.

import { config } from './config'
import { supabase } from './supabase'

const DB_NAME = 'tailor-audio'
const STORE = 'blobs'
const BUCKET = 'recordings'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openIdb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openIdb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as Blob) ?? null)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return blob
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb()
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
  db.close()
}

/** Salva o audio e retorna a referencia a guardar em note.audio_url. */
export async function saveAudio(noteId: string, userId: string, blob: Blob): Promise<string | null> {
  if (!blob || blob.size === 0) return null
  if (config.mockMode) {
    try {
      await idbPut(noteId, blob)
      return `idb:${noteId}`
    } catch {
      return null
    }
  }
  if (!supabase) return null
  const path = `${userId}/${noteId}.webm`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'audio/webm', upsert: true })
  return error ? null : path
}

/** Resolve uma URL tocavel a partir da referencia salva. */
export async function getAudioUrl(ref: string | null): Promise<string | null> {
  if (!ref) return null
  if (ref.startsWith('idb:')) {
    const blob = await idbGet(ref.slice(4))
    return blob ? URL.createObjectURL(blob) : null
  }
  if (ref.startsWith('http')) return ref
  if (!supabase) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(ref, 3600)
  return data?.signedUrl ?? null
}

export async function deleteAudio(ref: string | null): Promise<void> {
  if (!ref) return
  if (ref.startsWith('idb:')) return idbDelete(ref.slice(4))
  if (supabase && !ref.startsWith('http')) {
    await supabase.storage.from(BUCKET).remove([ref])
  }
}
