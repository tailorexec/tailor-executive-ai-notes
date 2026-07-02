import { DocPage, DocSection } from './DocPage'

export function Privacy() {
  return (
    <DocPage title="Politica de privacidade">
      <p className="text-sm text-content-muted">Ultima atualizacao: uso interno Tailor.</p>

      <DocSection title="Dados que coletamos">
        <p>Nome, sobrenome, e-mail corporativo e telefone (no cadastro). Conteudo que voce cria: audios, transcricoes, resumos, notas e metadados de uso.</p>
      </DocSection>
      <DocSection title="Como usamos">
        <p>Para autenticar, gerar transcricoes/resumos/analises com IA, organizar suas notas e permitir compartilhamento com parceiros que voce escolher.</p>
      </DocSection>
      <DocSection title="Onde ficam armazenados">
        <p>Os dados ficam no Supabase (banco Postgres e Storage privado). Os audios sao armazenados em bucket privado com acesso restrito ao dono e excluidos em 14 dias por padrao.</p>
      </DocSection>
      <DocSection title="Provedores de IA">
        <p>O audio e enviado a um servico de transcricao (Whisper) e os textos a modelos Claude (Anthropic) apenas para gerar os resultados. As chaves ficam no servidor; nao expomos suas informacoes publicamente.</p>
      </DocSection>
      <DocSection title="Compartilhamento">
        <p>Suas notas so sao compartilhadas quando voce decide (com parceiros cadastrados ou por exportacao). Nao vendemos seus dados.</p>
      </DocSection>
      <DocSection title="Seguranca">
        <p>Acesso restrito por autenticacao e regras de linha (RLS): cada usuario acessa apenas os proprios dados. O administrador tem visao agregada de uso.</p>
      </DocSection>
      <DocSection title="LGPD e seus direitos">
        <p>Voce pode acessar, corrigir e excluir seus dados. A exclusao de uma nota remove tambem o audio associado. Para solicitacoes, use o Suporte ou o administrador.</p>
      </DocSection>
      <DocSection title="Consentimento de gravacao">
        <p>Ao gravar reunioes e ligacoes, informe e obtenha consentimento das demais partes quando exigido por lei.</p>
      </DocSection>
    </DocPage>
  )
}
