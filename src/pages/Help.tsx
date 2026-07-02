import { DocPage, DocSection } from './DocPage'

export function Help() {
  return (
    <DocPage title="Central de ajuda">
      <p>Perguntas frequentes sobre como usar a ANA by Tailor.</p>

      <DocSection title="Como crio uma nota?">
        <p>
          Toque no microfone no centro da barra inferior para gravar, ou em "Nova nota" para escolher:
          Gravar reuniao, Enviar audio, PDF/arquivo/texto ou Link da web. A transcricao e o resumo sao
          gerados automaticamente.
        </p>
      </DocSection>

      <DocSection title="O que e 'Gravar reuniao'?">
        <p>
          No computador (Chrome/Edge), captura o audio da reuniao (Zoom/Meet/Teams) + o seu microfone —
          funciona ate de fone. Basta marcar "Compartilhar audio" no dialogo do navegador.
        </p>
      </DocSection>

      <DocSection title="Os campos (titulo, tema, contexto) sao obrigatorios?">
        <p>
          Nao. Todos sao opcionais. Se nao preencher, a IA gera a transcricao e o resumo normalmente. O
          tema e o contexto apenas ajudam a IA a analisar no formato certo (entrevista, reuniao, etc.).
        </p>
      </DocSection>

      <DocSection title="Identificar quem falou (diarizacao)">
        <p>
          Ative a chave "Identificar quem falou" antes de processar para separar os falantes na
          transcricao. Tem um custo um pouco maior.
        </p>
      </DocSection>

      <DocSection title="Como compartilho uma nota?">
        <p>
          Dentro da nota, toque em "Compartilhar": WhatsApp, e-mail, PDF, Word, copiar, baixar audio/
          transcricao — e tambem compartilhar direto com parceiros cadastrados.
        </p>
      </DocSection>

      <DocSection title="Gerar feedback e traduzir">
        <p>
          Dentro da nota ha botoes para gerar um feedback profissional (cliente ou candidato) e para
          traduzir o resumo para outro idioma.
        </p>
      </DocSection>

      <DocSection title="Por quanto tempo o audio fica guardado?">
        <p>
          Por padrao o audio e excluido automaticamente em 14 dias (a transcricao e as informacoes sao
          mantidas para sempre). Voce pode marcar "Manter audio para sempre" em cada nota.
        </p>
      </DocSection>

      <DocSection title="Discador">
        <p>
          Abra o discador, digite o numero e ligue pelo WhatsApp ou pelo telefone — a gravacao (viva-voz)
          inicia junto e vira uma nota. Ha historico de ligacoes.
        </p>
      </DocSection>

      <DocSection title="Conversar com todas as reunioes">
        <p>
          Na tela inicial, use "Conversar com todas as reunioes" para perguntar em linguagem natural e a
          IA responde consultando o conteudo de todas as suas notas.
        </p>
      </DocSection>

      <DocSection title="Precisa de suporte?">
        <p>Abra um chamado em Configuracoes → Suporte, escolhendo o tema (Financeiro, Tecnico, Feedback ou Outros).</p>
      </DocSection>
    </DocPage>
  )
}
