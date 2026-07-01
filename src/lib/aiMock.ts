// Deterministic, offline "AI" used in mock mode (sem chaves).
// Gera resultados plausiveis a partir da transcricao para que todo o
// fluxo do app seja navegavel/testavel antes de plugar a IA real.

import type { ActionItem, MeetingAnalysis } from './types'

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}

function pick<T>(arr: T[], n: number): T[] {
  return arr.slice(0, n)
}

export function mockSummary(transcript: string): string {
  const s = sentences(transcript)
  if (s.length === 0) return 'Resumo indisponivel: transcricao vazia.'
  const bullets = pick(s, 5).map((x) => `- ${x.replace(/[.!?]+$/, '')}.`)
  return bullets.join('\n')
}

export function mockDetailed(transcript: string): string {
  const s = sentences(transcript)
  const overview = pick(s, 3)
    .map((x) => `- ${x.replace(/[.!?]+$/, '')}.`)
    .join('\n')
  const details = s
    .slice(3, 10)
    .map((x) => `- ${x.replace(/[.!?]+$/, '')}.`)
    .join('\n')
  return [
    '## Visao geral',
    overview || '- Sem conteudo suficiente.',
    '',
    '## Pontos discutidos',
    details || '- Sem conteudo suficiente.',
    '',
    '## Proximos passos',
    '- Revisar os action items destacados.',
    '- Confirmar responsaveis e prazos.',
  ].join('\n')
}

export function mockActionItems(transcript: string): ActionItem[] {
  const s = sentences(transcript)
  const candidates = s.filter((x) =>
    /(precisa|vamos|deve|fazer|enviar|preparar|agendar|revisar|contratar|definir|alinhar)/i.test(x),
  )
  const chosen = (candidates.length ? candidates : s).slice(0, 4)
  return chosen.map((text, i) => ({
    id: `ai-${i}`,
    text: text.replace(/[.!?]+$/, ''),
    owner: undefined,
    due: undefined,
    done: false,
  }))
}

export function mockAnalysis(transcript: string): MeetingAnalysis {
  const s = sentences(transcript)
  const questions = s.filter((x) => x.includes('?'))
  return {
    overallScore: Math.min(92, 60 + Math.round(s.length * 1.5)),
    tone: 'Profissional e colaborativo, com abertura para discussao.',
    strengths: pick(
      [
        'Objetivos da reuniao ficaram claros logo no inicio.',
        'Boa escuta ativa entre os participantes.',
        'Decisoes foram registradas com responsaveis.',
      ],
      3,
    ),
    improvements: pick(
      [
        'Definir prazos explicitos para cada acao.',
        'Reduzir tangentes para manter o foco no tempo previsto.',
        'Confirmar entendimento com um resumo ao final.',
      ],
      3,
    ),
    questionsAsked: questions.slice(0, 4).map((q) => q.trim()),
    suggestedQuestions: [
      'Qual e o criterio de sucesso mensuravel deste projeto?',
      'Quem sera o responsavel final por cada entrega?',
      'Qual o maior risco que pode nos atrasar?',
    ],
    pacing: 'Ritmo adequado; a introducao poderia ser mais curta.',
    keyPoints: pick(
      s.map((x) => x.replace(/[.!?]+$/, '')),
      5,
    ),
    risks: pick(
      [
        'Falta de prazo definido pode atrasar as acoes.',
        'Dependencia de aprovacao externa nao confirmada.',
      ],
      2,
    ),
  }
}

const SAMPLE_TRANSCRIPT = `Bom dia a todos, obrigado por participarem desta reuniao de alinhamento.
O objetivo de hoje e definir a estrutura do time de marketing e os proximos passos.
Atualmente a gerencia esta vaga porque a Ana foi realocada para o comercial internacional.
Precisamos profissionalizar o marketing digital, a inteligencia de mercado e a comunicacao interna.
Qual e o orcamento disponivel para as novas contratacoes?
O orcamento anual gira em torno de dois milhoes, com forte gasto em feiras e eventos.
Vamos preparar um kick-off do projeto e um cronograma de busca para aprovacao.
Precisamos tambem revisar o material assim que ele for enviado pela consultoria.
Em noventa dias o novo profissional deve fazer um diagnostico interno e propor o organograma.
Fica combinado que a Fernanda dara suporte continuo na estrategia digital.`

/** Simula a transcricao de um audio quando nao ha provedor real. */
export function mockTranscript(): string {
  return SAMPLE_TRANSCRIPT.replace(/\n/g, ' ').trim()
}

/** Simula transcricao com identificacao de falantes (diarizacao). */
export function mockDiarizedTranscript(): string {
  return [
    'Falante A: Bom dia a todos, obrigado por participarem desta reuniao de alinhamento.',
    'Falante B: Bom dia. O objetivo de hoje e definir a estrutura do time de marketing.',
    'Falante A: Atualmente a gerencia esta vaga porque a Ana foi realocada para o comercial.',
    'Falante B: Qual e o orcamento disponivel para as novas contratacoes?',
    'Falante A: O orcamento anual gira em torno de dois milhoes, com forte gasto em eventos.',
    'Falante B: Combinado, vamos preparar um kick-off do projeto e um cronograma de busca.',
  ].join('\n')
}

export function mockFeedback(transcript: string, audience: 'cliente' | 'candidato'): string {
  const s = sentences(transcript)
  const pts = pick(s, 3).map((x) => `- ${x.replace(/[.!?]+$/, '')}.`).join('\n')
  const saud = audience === 'candidato' ? 'Ola,' : 'Prezado(a),'
  const fecho =
    audience === 'candidato'
      ? 'Agradecemos sua participacao no processo e seguimos a disposicao.'
      : 'Agradecemos a reuniao e seguimos a disposicao para os proximos passos.'
  return [
    saud,
    '',
    audience === 'candidato'
      ? 'Obrigado pela conversa. Compartilho abaixo um feedback da nossa interacao:'
      : 'Obrigado pela reuniao. Segue um resumo com os pontos principais e proximos passos:',
    '',
    pts || '- (pontos principais)',
    '',
    fecho,
  ].join('\n')
}

export function mockAskAll(
  question: string,
  notes: { title: string; summary: string }[],
): string {
  const words = question.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
  const hits = notes.filter((n) =>
    words.some((w) => `${n.title} ${n.summary}`.toLowerCase().includes(w)),
  )
  if (!hits.length) return 'Nao encontrei essa informacao nas suas reunioes.'
  const refs = hits.slice(0, 3).map((h) => `- ${h.title}`).join('\n')
  return `Com base nas suas reunioes, encontrei referencias em:\n${refs}\n\n(No modo real, a IA sintetiza a resposta a partir do conteudo dessas notas.)`
}

export function mockChatReply(question: string, transcript: string): string {
  const s = sentences(transcript)
  const hit = s.find((x) =>
    question
      .toLowerCase()
      .split(' ')
      .some((w) => w.length > 4 && x.toLowerCase().includes(w)),
  )
  return hit
    ? `Com base na nota: ${hit.replace(/[.!?]+$/, '')}.`
    : 'Com base nesta nota, nao encontrei um trecho especifico sobre isso. Poderia reformular a pergunta?'
}
