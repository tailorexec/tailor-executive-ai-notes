// "Reuniao por tema e contexto": ajuda a IA a resumir e analisar no formato
// certo daquele tipo de reuniao.

export type NoteTemplate = 'geral' | 'entrevista' | 'comercial' | 'um_a_um' | 'board'

export const TEMPLATES: { id: NoteTemplate; label: string; hint: string }[] = [
  { id: 'geral', label: 'Geral', hint: 'Resumo padrao de reuniao.' },
  {
    id: 'entrevista',
    label: 'Entrevista de candidato',
    hint: 'Competencias, fit cultural, pontos fortes/atencao e recomendacao.',
  },
  {
    id: 'comercial',
    label: 'Reuniao comercial',
    hint: 'Dores, objecoes, orcamento e probabilidade de fechamento.',
  },
  { id: 'um_a_um', label: '1:1', hint: 'Combinados, blockers, desenvolvimento e follow-ups.' },
  {
    id: 'board',
    label: 'Board / Diretoria',
    hint: 'Decisoes estrategicas, metricas, riscos e responsaveis.',
  },
]

export function templateLabel(id: string | null | undefined): string {
  return TEMPLATES.find((t) => t.id === id)?.label ?? 'Geral'
}
