import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { getLang, setLang as persistLang, type AppLang } from './lang'

// i18n reativo. Wave 1: navegacao, home, assistente ANA, agenda, "nova nota".
// Telas de conteudo (termos, ajuda, etc.) sao traduzidas progressivamente.

type Dict = Record<string, string>

const pt: Dict = {
  'nav.notes': 'Notas',
  'nav.dialer': 'Discador',
  'nav.admin': 'Admin',
  'nav.config': 'Config',
  'sidebar.menu': 'Menu',
  'sidebar.smartRec': 'Gravação Inteligente',
  'sidebar.talkAna': 'Falar com a ANA',
  'sidebar.anaSub': 'Sua assistente com PhD. Tire dúvidas sobre o app.',
  'home.title': 'Minhas notas',
  'home.search': 'Pesquisar anotações e transcrições',
  'home.chatAll': 'Conversar com todas as reuniões',
  'home.chatAllSub': 'Pergunte à IA sobre qualquer nota',
  'home.all': 'Todas',
  'home.sortRecent': 'Mais recentes',
  'home.sortOldest': 'Mais antigas',
  'home.sortLongest': 'Mais longas',
  'home.noteOne': 'nota',
  'home.noteMany': 'notas',
  'home.emptyTitle': 'Nenhuma nota ainda',
  'home.emptySub': 'Grave uma reunião, envie um áudio ou um arquivo para começar.',
  'home.noResultTitle': 'Nenhum resultado',
  'home.noResultSub': 'Tente outro termo de busca ou limpe os filtros.',
  'home.clearFilters': 'Limpar filtros',
  'home.newNote': 'Nova nota',
  'home.processing': 'processando',
  'ana.float': 'ANA, assistente com PhD: me pergunte algo!',
  'new.title': 'Nova nota',
  'new.recordMeeting': 'Gravar reunião',
  'new.recordMeetingHint': 'Áudio da reunião + seu microfone',
  'new.uploadAudio': 'Enviar áudio',
  'new.uploadAudioHint': 'Importe um arquivo de áudio',
  'new.uploadVideo': 'Enviar vídeo',
  'new.uploadVideoHint': 'A IA extrai o áudio e transcreve',
  'new.file': 'PDF, arquivo ou texto',
  'new.fileHint': 'Resuma um documento',
  'new.link': 'Link da web',
  'new.linkHint': 'Resuma o conteúdo de um link',
  'events.title': 'Próximos eventos',
  'events.connect': 'Conectar Google Calendar',
  'events.see': 'Ver meus eventos',
  'events.mine': 'Meus eventos',
  'events.none': 'Nenhum evento próximo.',
  'events.update': 'Atualizar',
  'events.disconnect': 'Desconectar',
  'events.allDay': 'dia todo',
  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
}

const en: Dict = {
  'nav.notes': 'Notes',
  'nav.dialer': 'Dialer',
  'nav.admin': 'Admin',
  'nav.config': 'Settings',
  'sidebar.menu': 'Menu',
  'sidebar.smartRec': 'Smart Recording',
  'sidebar.talkAna': 'Talk to ANA',
  'sidebar.anaSub': 'Your PhD assistant. Ask anything about the app.',
  'home.title': 'My notes',
  'home.search': 'Search notes and transcripts',
  'home.chatAll': 'Chat with all meetings',
  'home.chatAllSub': 'Ask the AI about any note',
  'home.all': 'All',
  'home.sortRecent': 'Most recent',
  'home.sortOldest': 'Oldest',
  'home.sortLongest': 'Longest',
  'home.noteOne': 'note',
  'home.noteMany': 'notes',
  'home.emptyTitle': 'No notes yet',
  'home.emptySub': 'Record a meeting, upload an audio or a file to get started.',
  'home.noResultTitle': 'No results',
  'home.noResultSub': 'Try another search term or clear the filters.',
  'home.clearFilters': 'Clear filters',
  'home.newNote': 'New note',
  'home.processing': 'processing',
  'ana.float': 'ANA, PhD assistant: ask me anything!',
  'new.title': 'New note',
  'new.recordMeeting': 'Record meeting',
  'new.recordMeetingHint': 'Meeting audio + your microphone',
  'new.uploadAudio': 'Upload audio',
  'new.uploadAudioHint': 'Import an audio file',
  'new.uploadVideo': 'Upload video',
  'new.uploadVideoHint': 'The AI extracts the audio and transcribes',
  'new.file': 'PDF, file or text',
  'new.fileHint': 'Summarize a document',
  'new.link': 'Web link',
  'new.linkHint': 'Summarize the content of a link',
  'events.title': 'Upcoming events',
  'events.connect': 'Connect Google Calendar',
  'events.see': 'See my events',
  'events.mine': 'My events',
  'events.none': 'No upcoming events.',
  'events.update': 'Refresh',
  'events.disconnect': 'Disconnect',
  'events.allDay': 'all day',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
}

const es: Dict = {
  'nav.notes': 'Notas',
  'nav.dialer': 'Marcador',
  'nav.admin': 'Admin',
  'nav.config': 'Ajustes',
  'sidebar.menu': 'Menú',
  'sidebar.smartRec': 'Grabación Inteligente',
  'sidebar.talkAna': 'Hablar con ANA',
  'sidebar.anaSub': 'Tu asistente con PhD. Pregunta sobre la app.',
  'home.title': 'Mis notas',
  'home.search': 'Buscar notas y transcripciones',
  'home.chatAll': 'Conversar con todas las reuniones',
  'home.chatAllSub': 'Pregúntale a la IA sobre cualquier nota',
  'home.all': 'Todas',
  'home.sortRecent': 'Más recientes',
  'home.sortOldest': 'Más antiguas',
  'home.sortLongest': 'Más largas',
  'home.noteOne': 'nota',
  'home.noteMany': 'notas',
  'home.emptyTitle': 'Aún no hay notas',
  'home.emptySub': 'Graba una reunión, sube un audio o un archivo para empezar.',
  'home.noResultTitle': 'Sin resultados',
  'home.noResultSub': 'Prueba otro término o limpia los filtros.',
  'home.clearFilters': 'Limpiar filtros',
  'home.newNote': 'Nueva nota',
  'home.processing': 'procesando',
  'ana.float': 'ANA, asistente con PhD: ¡pregúntame algo!',
  'new.title': 'Nueva nota',
  'new.recordMeeting': 'Grabar reunión',
  'new.recordMeetingHint': 'Audio de la reunión + tu micrófono',
  'new.uploadAudio': 'Subir audio',
  'new.uploadAudioHint': 'Importa un archivo de audio',
  'new.uploadVideo': 'Subir video',
  'new.uploadVideoHint': 'La IA extrae el audio y transcribe',
  'new.file': 'PDF, archivo o texto',
  'new.fileHint': 'Resume un documento',
  'new.link': 'Enlace web',
  'new.linkHint': 'Resume el contenido de un enlace',
  'events.title': 'Próximos eventos',
  'events.connect': 'Conectar Google Calendar',
  'events.see': 'Ver mis eventos',
  'events.mine': 'Mis eventos',
  'events.none': 'No hay eventos próximos.',
  'events.update': 'Actualizar',
  'events.disconnect': 'Desconectar',
  'events.allDay': 'todo el día',
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
}

const DICTS: Record<AppLang, Dict> = { pt, en, es }

interface I18nCtx {
  lang: AppLang
  setLang: (l: AppLang) => void
  t: (key: string) => string
}

const Ctx = createContext<I18nCtx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AppLang>(getLang())

  const setLang = useCallback((l: AppLang) => {
    persistLang(l)
    setLangState(l)
  }, [])

  const t = useCallback((key: string) => DICTS[lang][key] ?? pt[key] ?? key, [lang])

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useI18n deve ser usado dentro de I18nProvider')
  return ctx
}

export function useT(): (key: string) => string {
  return useI18n().t
}
