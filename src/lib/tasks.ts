// Tarefas avulsas (criadas a mao). As tarefas vindas de notas continuam em `notes.action_items`.

import { supabase } from './supabase'
import type { Task } from './types'
import { TASK_TEXT_MAX } from './types'

function client() {
  if (!supabase) throw new Error('Supabase nao configurado')
  return supabase
}

export const tasksEnabled = () => !!supabase

export async function listTasks(userId: string): Promise<Task[]> {
  if (!supabase) return []
  const { data, error } = await client()
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Task[]
}

export async function createTask(
  userId: string,
  input: { text: string; owner?: string; due?: string },
): Promise<Task> {
  const text = input.text.trim().slice(0, TASK_TEXT_MAX)
  if (!text) throw new Error('Tarefa vazia')

  const { data, error } = await client()
    .from('tasks')
    .insert({
      user_id: userId,
      text,
      owner: input.owner?.trim() || null,
      due: input.due || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Task
}

export async function setTaskDone(id: string, done: boolean): Promise<Task> {
  const { data, error } = await client().from('tasks').update({ done }).eq('id', id).select().single()
  if (error) throw error
  return data as Task
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await client().from('tasks').delete().eq('id', id)
  if (error) throw error
}
