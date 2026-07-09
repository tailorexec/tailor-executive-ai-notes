// Base de perguntas e respostas sobre o uso do app (mesma da Central de ajuda).
// Usada para responder localmente (sem custo de IA) quando ha correspondencia.

export interface HelpEntry {
  q: string
  a: string
  keywords: string[]
}

export const HELP_KB: HelpEntry[] = [
  {
    q: 'Como crio uma nota?',
    a: 'Toque no microfone no centro da barra inferior para gravar pelo microfone, ou em "Nova nota" para escolher: Gravar reuniao, Enviar audio, Enviar video, PDF/arquivo/texto ou Link. A transcricao e o resumo sao gerados automaticamente.',
    keywords: ['criar', 'nota', 'nova', 'comecar', 'gravar', 'como', 'faco'],
  },
  {
    q: 'Como gravar uma reuniao com o audio da chamada?',
    a: 'No computador (Chrome/Edge), use "Gravar Meet": ele captura o audio da aba/tela + seu microfone (funciona ate de fone). Marque "Compartilhar audio" no dialogo. No celular isso nao e possivel: o sistema (Android e iOS) nao deixa nenhum app capturar o audio de uma chamada de outro app. No celular, use o viva-voz e grave pelo microfone.',
    keywords: ['reuniao', 'audio', 'interno', 'zoom', 'meet', 'teams', 'chamada', 'fone', 'sistema', 'aba'],
  },
  {
    q: 'Os campos titulo, tema e contexto sao obrigatorios?',
    a: 'Nao, todos sao opcionais. Se nao preencher, a IA gera a transcricao e o resumo normalmente. O tema e o contexto apenas ajudam a IA a analisar no formato certo (entrevista, reuniao, alinhamento).',
    keywords: ['campos', 'obrigatorio', 'titulo', 'tema', 'contexto', 'opcional'],
  },
  {
    q: 'O que e identificar quem falou (diarizacao)?',
    a: 'E uma chave que voce ativa antes de processar para separar os falantes na transcricao (Falante A, Falante B...). Tem um custo um pouco maior.',
    keywords: ['quem', 'falou', 'diarizacao', 'falantes', 'separar'],
  },
  {
    q: 'Como compartilho uma nota?',
    a: 'Dentro da nota toque em "Compartilhar": WhatsApp, e-mail, PDF, Word, copiar, baixar audio/transcricao — e tambem compartilhar direto com parceiros cadastrados na plataforma.',
    keywords: ['compartilhar', 'enviar', 'whatsapp', 'pdf', 'word', 'email', 'parceiro', 'exportar'],
  },
  {
    q: 'Como edito o titulo ou o resumo de uma nota?',
    a: 'Dentro da nota, toque nos tres pontinhos (ao lado de Compartilhar) e escolha "Editar titulo", "Editar resumo" ou "Copiar nota".',
    keywords: ['editar', 'titulo', 'resumo', 'alterar', 'copiar', 'pontinhos'],
  },
  {
    q: 'Como traduzo uma nota?',
    a: 'Dentro da nota ha o botao "Traduzir": escolha o idioma e a IA traduz o resumo. Da para copiar o resultado.',
    keywords: ['traduzir', 'idioma', 'ingles', 'espanhol', 'traducao'],
  },
  {
    q: 'Como uso as pastas?',
    a: 'Toque no icone de pasta no topo da tela inicial para criar pastas (com nome e cor), editar ou excluir. Dentro de cada nota, use "Adicionar a uma pasta" para organiza-la (da para criar a pasta ali mesmo).',
    keywords: ['pasta', 'pastas', 'organizar', 'cor', 'categoria'],
  },
  {
    q: 'Por quanto tempo o audio fica guardado?',
    a: 'Por padrao o audio e excluido automaticamente em 14 dias (a transcricao e as informacoes ficam guardadas para sempre). Voce pode marcar "Manter audio para sempre" em cada nota.',
    keywords: ['audio', 'guardado', 'retencao', 'excluido', 'apagar', 'tempo', '14 dias', 'manter'],
  },
  {
    q: 'Como funciona o discador?',
    a: 'Abra o Discador, digite o numero e escolha ligar pelo WhatsApp ou pelo telefone — a gravacao (viva-voz) inicia junto e vira uma nota. Ha historico de ligacoes. Obs.: em ligacoes reais no celular, o navegador pode nao captar o audio; use o viva-voz.',
    keywords: ['discador', 'ligar', 'ligacao', 'telefone', 'whatsapp', 'chamada', 'historico'],
  },
  {
    q: 'Como pergunto a IA sobre todas as minhas reunioes?',
    a: 'Na tela inicial, use "Conversar com todas as reunioes" para perguntar em linguagem natural — a IA responde consultando o conteudo de todas as suas notas.',
    keywords: ['perguntar', 'buscar', 'todas', 'reunioes', 'semantica', 'procurar'],
  },
  {
    q: 'Como exporto meus dados / faco backup?',
    a: 'Em Configuracoes → Meus dados → "Exportar meus dados (Markdown)": baixa todas as suas notas num arquivo pequeno, ideal para colar em IA ou abrir no Word.',
    keywords: ['exportar', 'backup', 'dados', 'markdown', 'baixar', 'salvar'],
  },
  {
    q: 'Como altero minha foto e nome?',
    a: 'Em Configuracoes, toque no avatar para trocar a foto, ou no lapis para editar nome e sobrenome.',
    keywords: ['foto', 'perfil', 'nome', 'avatar', 'alterar', 'mudar'],
  },
  {
    q: 'Como falo com o suporte?',
    a: 'Em Configuracoes → Falar com o suporte. Abra um chamado escolhendo o tema (Financeiro, Tecnico, Feedback ou Outros).',
    keywords: ['suporte', 'ajuda', 'chamado', 'ticket', 'problema', 'contato'],
  },
  {
    q: 'Como enviar um video para transcrever?',
    a: 'Em "Nova nota" escolha "Enviar video". A IA extrai apenas o audio e transcreve; o video nao e armazenado (limite de 25 MB).',
    keywords: ['video', 'enviar', 'transcrever', 'extrair'],
  },
]

/** Concatena a base para dar contexto a IA (fallback). */
export const HELP_KB_TEXT = HELP_KB.map((e) => `P: ${e.q}\nR: ${e.a}`).join('\n\n')

const STOP = new Set(['como', 'para', 'que', 'uma', 'meu', 'minha', 'the', 'de', 'do', 'da', 'e', 'o', 'a'])

/** Busca local por palavras-chave. Retorna a melhor resposta se houver boa correspondencia. */
export function searchHelp(query: string): HelpEntry | null {
  const words = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\W+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
  if (words.length === 0) return null
  let best: HelpEntry | null = null
  let bestScore = 0
  for (const e of HELP_KB) {
    const hay = (e.q + ' ' + e.keywords.join(' '))
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
    let score = 0
    for (const w of words) if (hay.includes(w)) score++
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return bestScore >= 2 ? best : null
}
