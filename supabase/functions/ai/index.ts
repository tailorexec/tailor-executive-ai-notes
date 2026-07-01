// Edge Function: IA (resumo, detalhado, analise, action items, chat).
// Guarda a ANTHROPIC_API_KEY no servidor. Deploy: `supabase functions deploy ai`.
//
// Roteamento de modelos (custo x qualidade):
//   summary / action_items / chat -> Haiku 4.5  (rapido e barato)
//   detailed / analysis           -> Sonnet 5   (qualidade alta)

// @ts-nocheck  (ambiente Deno; tipos resolvidos no runtime do Supabase)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const HAIKU = 'claude-haiku-4-5-20251001'
const SONNET = 'claude-sonnet-5'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function claude(model: string, system: string, user: string, maxTokens = 1500): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

function extractJson<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    return match ? (JSON.parse(match[0]) as T) : fallback
  } catch {
    return fallback
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const task = body.task as string
    const transcript = (body.transcript as string) ?? ''
    let out: Record<string, unknown> = {}

    if (task === 'summary') {
      const text = await claude(
        HAIKU,
        'Voce e um assistente executivo. Resuma reunioes de forma clara, precisa e acionavel, em portugues do Brasil. Nunca invente informacoes. Use bullets curtos comecando com "- ".',
        `Resuma a reuniao a seguir em 5 a 8 bullets objetivos, destacando decisoes e proximos passos.\n\nTRANSCRICAO:\n${transcript}`,
        800,
      )
      out = { summary: text.trim() }
    } else if (task === 'detailed') {
      const text = await claude(
        SONNET,
        'Voce e um consultor senior. Produza resumos executivos detalhados, estruturados e fieis ao conteudo, em portugues do Brasil. Use markdown com secoes (##).',
        `Gere um resumo DETALHADO e inteligente da reuniao com as secoes: ## Visao geral, ## Pontos discutidos, ## Decisoes, ## Riscos, ## Proximos passos. Seja fiel a transcricao.\n\nTRANSCRICAO:\n${transcript}`,
        2500,
      )
      out = { detailed: text.trim() }
    } else if (task === 'action_items') {
      const text = await claude(
        HAIKU,
        'Extraia tarefas acionaveis de reunioes. Responda APENAS com um array JSON.',
        `Extraia os action items da transcricao. Retorne um array JSON de objetos {"id":string,"text":string,"owner":string|null,"due":string|null,"done":false}. Se nao houver, retorne [].\n\nTRANSCRICAO:\n${transcript}`,
        1000,
      )
      out = { actionItems: extractJson(text, []) }
    } else if (task === 'analysis') {
      const text = await claude(
        SONNET,
        'Voce e um coach de reunioes executivas. Analise objetivamente e responda APENAS com JSON valido.',
        `Analise a reuniao e retorne um JSON com o formato exato:
{"overallScore":number(0-100),"tone":string,"strengths":string[],"improvements":string[],"questionsAsked":string[],"suggestedQuestions":string[],"pacing":string,"keyPoints":string[],"risks":string[]}
Foque em: tom, perguntas feitas e sugeridas, ritmo/andamento, pontos fortes, melhorias e dicas praticas para reunioes melhores. Em portugues do Brasil.\n\nTRANSCRICAO:\n${transcript}`,
        2000,
      )
      out = {
        analysis: extractJson(text, {
          tone: '', strengths: [], improvements: [], questionsAsked: [],
          suggestedQuestions: [], pacing: '', keyPoints: [], risks: [],
        }),
      }
    } else if (task === 'chat') {
      const question = body.question as string
      const history = (body.history as { role: string; content: string }[]) ?? []
      const context = history.map((h) => `${h.role}: ${h.content}`).join('\n')
      const text = await claude(
        HAIKU,
        'Responda perguntas com base APENAS na transcricao fornecida. Se a resposta nao estiver nela, diga que nao encontrou. Portugues do Brasil.',
        `TRANSCRICAO:\n${transcript}\n\nHISTORICO:\n${context}\n\nPERGUNTA: ${question}`,
        800,
      )
      out = { reply: text.trim() }
    } else {
      return new Response(JSON.stringify({ error: 'task invalida' }), {
        status: 400,
        headers: { ...cors, 'content-type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(out), {
      headers: { ...cors, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, 'content-type': 'application/json' },
    })
  }
})
