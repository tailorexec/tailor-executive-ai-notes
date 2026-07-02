import { DocPage, DocSection } from './DocPage'

export function Terms() {
  return (
    <DocPage title="Termos de servico">
      <p className="text-sm text-content-muted">Ultima atualizacao: uso interno Tailor.</p>

      <DocSection title="1. Aceitacao">
        <p>Ao usar a ANA by Tailor ("aplicativo"), voce concorda com estes Termos. O acesso e restrito a colaboradores com e-mail @tailorexec.com.br.</p>
      </DocSection>
      <DocSection title="2. Uso da plataforma">
        <p>O aplicativo grava, transcreve, resume e organiza reunioes e audios. Voce e responsavel pelo conteudo que grava e por obter o consentimento das pessoas envolvidas antes de gravar, conforme a legislacao aplicavel (LGPD).</p>
      </DocSection>
      <DocSection title="3. Conta e seguranca">
        <p>Voce e responsavel por manter a confidencialidade das suas credenciais. Notifique o administrador em caso de uso nao autorizado.</p>
      </DocSection>
      <DocSection title="4. Conteudo e propriedade">
        <p>O conteudo das suas notas pertence a voce/organizacao. Concede-se ao aplicativo o direito de processar esse conteudo (transcricao, resumo, analise) para prestar o servico.</p>
      </DocSection>
      <DocSection title="5. Inteligencia artificial">
        <p>Os resumos e analises sao gerados por IA e podem conter imprecisoes. Revise informacoes criticas antes de tomar decisoes.</p>
      </DocSection>
      <DocSection title="6. Uso aceitavel">
        <p>E proibido usar o aplicativo para fins ilegais, gravar sem consentimento quando exigido, ou tentar comprometer a seguranca do sistema.</p>
      </DocSection>
      <DocSection title="7. Retencao">
        <p>Os arquivos de audio sao excluidos automaticamente apos 14 dias, salvo se voce optar por mante-los. Transcricoes e informacoes sao preservadas na sua conta.</p>
      </DocSection>
      <DocSection title="8. Limitacao de responsabilidade">
        <p>O aplicativo e fornecido "como esta". Nao nos responsabilizamos por perdas decorrentes do uso, na maxima extensao permitida por lei.</p>
      </DocSection>
      <DocSection title="9. Contato">
        <p>Duvidas: abra um chamado em Configuracoes → Suporte ou contate o administrador.</p>
      </DocSection>
    </DocPage>
  )
}
