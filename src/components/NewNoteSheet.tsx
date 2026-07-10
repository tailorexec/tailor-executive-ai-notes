import { useNavigate } from 'react-router-dom'
import { Headphones, Upload, Video, FileText, Link2, Mic, Image as ImageIcon } from 'lucide-react'
import { Sheet } from './ui'
import { useT } from '../lib/i18n'

/** Folha de funcoes: todas as formas de criar uma nota, abertas pelo microfone central. */
export function NewNoteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const t = useT()

  function startCapture(mode: string) {
    onClose()
    navigate(`/capturar?mode=${mode}`)
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('new.title')}>
      <div className="space-y-3">
        <NewOption icon={<Mic size={20} />} label={t('new.smartRec')} hint={t('new.smartRecHint')} onClick={() => startCapture('record')} />
        <NewOption icon={<Headphones size={20} />} label={t('new.recordMeeting')} hint={t('new.recordMeetingHint')} onClick={() => startCapture('meeting')} />
        <NewOption icon={<Upload size={20} />} label={t('new.uploadAudio')} hint={t('new.uploadAudioHint')} onClick={() => startCapture('upload')} />
        <NewOption icon={<Video size={20} />} label={t('new.uploadVideo')} hint={t('new.uploadVideoHint')} onClick={() => startCapture('video')} />
        <NewOption icon={<FileText size={20} />} label={t('new.file')} hint={t('new.fileHint')} onClick={() => startCapture('file')} />
        <NewOption icon={<ImageIcon size={20} />} label={t('new.image')} hint={t('new.imageHint')} onClick={() => startCapture('image')} />
        <NewOption icon={<Link2 size={20} />} label={t('new.link')} hint={t('new.linkHint')} onClick={() => startCapture('link')} />
      </div>
    </Sheet>
  )
}

function NewOption({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-surface-elevated border border-surface-border rounded-2xl px-4 py-3.5 text-left hover:border-accent/40 transition-colors"
    >
      <div className="grid place-items-center h-10 w-10 rounded-full bg-brand-solid text-white shrink-0">{icon}</div>
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-content-muted">{hint}</p>
      </div>
    </button>
  )
}
