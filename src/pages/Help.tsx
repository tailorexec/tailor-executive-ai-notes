import { DocPage, DocSection } from './DocPage'
import { useI18n } from '../lib/i18n'

type Faq = { title: string; intro: string; items: { q: string; a: string }[] }

const FAQ: Record<'pt' | 'en' | 'es', Faq> = {
  pt: {
    title: 'Central de ajuda',
    intro: 'Perguntas frequentes sobre como usar a ANA by Tailor.',
    items: [
      {
        q: 'Como crio uma nota?',
        a: 'Toque no microfone no centro da barra inferior para gravar, ou em "Funções/Nova nota" para escolher: Gravar reunião, Enviar áudio, Enviar vídeo, PDF/arquivo/texto ou Link da web. A transcrição e o resumo são gerados automaticamente.',
      },
      {
        q: "O que é 'Gravar reunião'?",
        a: 'No computador (Chrome/Edge), captura o áudio da reunião (Zoom/Meet/Teams) + o seu microfone — funciona até de fone. Basta marcar "Compartilhar áudio" no diálogo do navegador.',
      },
      {
        q: 'Importar PDF, DOCX ou link',
        a: 'Em "PDF, arquivo ou texto", o texto de PDFs e DOCX é extraído automaticamente ao processar. Em "Link da web", a IA abre a página, extrai o conteúdo principal e gera o resumo.',
      },
      {
        q: 'Os campos (título, tema, contexto) são obrigatórios?',
        a: 'Não. Todos são opcionais. O tema e o contexto apenas ajudam a IA a analisar no formato certo (entrevista, reunião, etc.).',
      },
      {
        q: 'Identificar quem falou (diarização)',
        a: 'Ative a chave "Identificar quem falou" antes de processar para separar os falantes na transcrição. Tem um custo um pouco maior.',
      },
      {
        q: 'Prioridade das notas',
        a: 'Dentro da nota, no menu "…", defina a prioridade (Alta, Média ou Baixa). Ela aparece como uma bandeirinha colorida no card da nota e dentro dela.',
      },
      {
        q: 'Minhas tarefas',
        a: 'Todos os action items das suas reuniões ficam reunidos em "Tarefas": filtre por em aberto/concluídas e marque como feito — reflete na nota de origem.',
      },
      {
        q: 'Como compartilho uma nota?',
        a: 'Dentro da nota, toque em "Compartilhar": WhatsApp, e-mail, PDF, Word, copiar, baixar áudio/transcrição — e também compartilhar direto com parceiros cadastrados.',
      },
      {
        q: 'Por quanto tempo o áudio fica guardado?',
        a: 'Por padrão o áudio é excluído automaticamente em 14 dias (a transcrição e as informações são mantidas para sempre). Você pode marcar "Manter áudio para sempre" em cada nota.',
      },
      {
        q: 'Precisa de suporte?',
        a: 'Abra um chamado em Configurações → Suporte, escolhendo o tema (Financeiro, Técnico, Feedback ou Outros).',
      },
    ],
  },
  en: {
    title: 'Help center',
    intro: 'Frequently asked questions about using ANA by Tailor.',
    items: [
      {
        q: 'How do I create a note?',
        a: 'Tap the microphone in the center of the bottom bar to record, or "More/New note" to choose: Record meeting, Upload audio, Upload video, PDF/file/text or Web link. The transcript and summary are generated automatically.',
      },
      {
        q: "What is 'Record meeting'?",
        a: 'On desktop (Chrome/Edge) it captures the meeting audio (Zoom/Meet/Teams) + your microphone — even with headphones. Just check "Share audio" in the browser dialog.',
      },
      {
        q: 'Import PDF, DOCX or a link',
        a: 'Under "PDF, file or text", the text of PDFs and DOCX is extracted automatically when you process it. Under "Web link", the AI opens the page, extracts the main content and summarizes it.',
      },
      {
        q: 'Are the fields (title, topic, context) required?',
        a: 'No. All are optional. Topic and context only help the AI analyze in the right format (interview, meeting, etc.).',
      },
      {
        q: 'Identify who spoke (diarization)',
        a: 'Turn on "Identify who spoke" before processing to separate speakers in the transcript. It costs a bit more.',
      },
      {
        q: 'Note priority',
        a: 'Inside a note, in the "…" menu, set the priority (High, Medium or Low). It shows as a colored flag on the note card and inside it.',
      },
      {
        q: 'My tasks',
        a: 'All action items from your meetings are gathered in "Tasks": filter by open/done and check them off — it reflects in the source note.',
      },
      {
        q: 'How do I share a note?',
        a: 'Inside a note, tap "Share": WhatsApp, email, PDF, Word, copy, download audio/transcript — and also share directly with registered partners.',
      },
      {
        q: 'How long is the audio kept?',
        a: 'By default the audio is deleted automatically after 14 days (the transcript and information are kept forever). You can turn on "Keep audio forever" per note.',
      },
      {
        q: 'Need support?',
        a: 'Open a ticket in Settings → Support, choosing the topic (Billing, Technical, Feedback or Other).',
      },
    ],
  },
  es: {
    title: 'Centro de ayuda',
    intro: 'Preguntas frecuentes sobre el uso de ANA by Tailor.',
    items: [
      {
        q: '¿Cómo creo una nota?',
        a: 'Toca el micrófono en el centro de la barra inferior para grabar, o "Funciones/Nueva nota" para elegir: Grabar reunión, Subir audio, Subir video, PDF/archivo/texto o Enlace web. La transcripción y el resumen se generan automáticamente.',
      },
      {
        q: '¿Qué es "Grabar reunión"?',
        a: 'En el ordenador (Chrome/Edge) captura el audio de la reunión (Zoom/Meet/Teams) + tu micrófono — incluso con auriculares. Solo marca "Compartir audio" en el diálogo del navegador.',
      },
      {
        q: 'Importar PDF, DOCX o un enlace',
        a: 'En "PDF, archivo o texto", el texto de PDF y DOCX se extrae automáticamente al procesar. En "Enlace web", la IA abre la página, extrae el contenido principal y lo resume.',
      },
      {
        q: '¿Los campos (título, tema, contexto) son obligatorios?',
        a: 'No. Todos son opcionales. El tema y el contexto solo ayudan a la IA a analizar en el formato correcto (entrevista, reunión, etc.).',
      },
      {
        q: 'Identificar quién habló (diarización)',
        a: 'Activa "Identificar quién habló" antes de procesar para separar los hablantes en la transcripción. Tiene un coste un poco mayor.',
      },
      {
        q: 'Prioridad de las notas',
        a: 'Dentro de la nota, en el menú "…", define la prioridad (Alta, Media o Baja). Aparece como una banderita de color en la tarjeta de la nota y dentro de ella.',
      },
      {
        q: 'Mis tareas',
        a: 'Todos los elementos de acción de tus reuniones se reúnen en "Tareas": filtra por abiertas/hechas y márcalas como hechas — se refleja en la nota de origen.',
      },
      {
        q: '¿Cómo comparto una nota?',
        a: 'Dentro de la nota, toca "Compartir": WhatsApp, correo, PDF, Word, copiar, descargar audio/transcripción — y también compartir directamente con socios registrados.',
      },
      {
        q: '¿Cuánto tiempo se guarda el audio?',
        a: 'Por defecto el audio se elimina automáticamente a los 14 días (la transcripción y la información se conservan para siempre). Puedes activar "Mantener audio para siempre" en cada nota.',
      },
      {
        q: '¿Necesitas soporte?',
        a: 'Abre un ticket en Ajustes → Soporte, eligiendo el tema (Facturación, Técnico, Feedback u Otros).',
      },
    ],
  },
}

export function Help() {
  const { lang } = useI18n()
  const faq = FAQ[lang] ?? FAQ.pt
  return (
    <DocPage title={faq.title}>
      <p>{faq.intro}</p>
      {faq.items.map((it) => (
        <DocSection key={it.q} title={it.q}>
          <p>{it.a}</p>
        </DocSection>
      ))}
    </DocPage>
  )
}
