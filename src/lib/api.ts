// Picks the active data backend based on configuration.
import { config } from './config'
import type { Db } from './db'
import { mockDb } from './mockDb'
import { supabaseDb } from './supabaseDb'

export const db: Db = config.mockMode ? mockDb : supabaseDb
export { config }
