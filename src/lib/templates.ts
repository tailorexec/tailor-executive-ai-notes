// "Tema" da nota: ajuda a IA a resumir/analisar no formato certo daquele tipo.

export type NoteTemplate = 'geral' | 'entrevista' | 'reuniao' | 'alinhamento' | 'outros'

export const TEMPLATES: { id: NoteTemplate; label: string; hint: string }[] = [
  { id: 'geral', label: 'Geral', hint: 'Resumo padrao do conteudo.' },
  {
    id: 'entrevista',
    label: 'Entrevista',
    hint: 'Competencias, fit cultural, pontos fortes/atencao e recomendacao.',
  },
  {
    id: 'reuniao',
    label: 'Reuniao',
    hint: 'Decisoes, proximos passos, dores/oportunidades e responsaveis.',
  },
  { id: 'alinhamento', label: 'Alinhamento', hint: 'Combinados, responsaveis e follow-ups.' },
  { id: 'outros', label: 'Outros', hint: 'Resumo geral do conteudo.' },
]

export function templateLabel(id: string | null | undefined): string {
  return TEMPLATES.find((t) => t.id === id)?.label ?? 'Geral'
}
