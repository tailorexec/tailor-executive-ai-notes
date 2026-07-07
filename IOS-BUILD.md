# Gerar o app iOS (ANA by Tailor)

O app iOS é um wrapper Capacitor (WKWebView) que carrega o site publicado
(`https://tailor-executive-ai-notes.vercel.app`), igual ao Android. **Todo o build iOS precisa
rodar no macOS** (Xcode + CocoaPods). Faça os passos abaixo no **MacBook Air**.

## 0. Pré-requisitos (uma vez, no Mac)

1. **Xcode** — instale pela App Store e abra 1 vez para aceitar a licença.
2. Ferramentas de linha de comando: `xcode-select --install`
3. **CocoaPods**: `sudo gem install cocoapods` (ou `brew install cocoapods`)
4. **Node LTS** (v20+) e **git** (via brew: `brew install node git`).
5. Uma conta **Apple** (o Apple ID grátis já roda no seu próprio iPhone; TestFlight/App Store
   exigem o **Apple Developer Program**, US$99/ano).

## 1. Pegar o projeto

```bash
git clone https://github.com/tailorexec/tailor-executive-ai-notes.git
cd tailor-executive-ai-notes
npm install
npm run build          # gera dist/ (o wrapper usa server.url, mas o build valida tudo)
```

## 2. Adicionar a plataforma iOS + assets

```bash
npx cap add ios                      # cria a pasta ios/ (roda pod install)
npx @capacitor/assets generate --ios # gera ícones e splash a partir de assets/icon.png e splash*.png
npx cap sync ios
```

## 3. Permissões (Info.plist)

Abra `ios/App/App/Info.plist` e adicione estas chaves (o app grava áudio e pode usar câmera/galeria
para foto de perfil e upload de vídeo):

```xml
<key>NSMicrophoneUsageDescription</key>
<string>O ANA usa o microfone para gravar e transcrever suas reuniões.</string>
<key>NSCameraUsageDescription</key>
<string>O ANA usa a câmera para foto de perfil e captura de mídia.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>O ANA acessa suas fotos/vídeos para foto de perfil e envio de arquivos.</string>
```

## 4. Abrir no Xcode, assinar e rodar

```bash
npx cap open ios
```

No Xcode:
1. Selecione o target **App** → aba **Signing & Capabilities**.
2. Em **Team**, escolha seu Apple ID (adicione em Xcode ▸ Settings ▸ Accounts se preciso).
3. O **Bundle Identifier** já é `br.com.tailorexec.tena`. Se der conflito, troque para algo único
   (ex.: `br.com.tailorexec.ana`).
4. Conecte o **iPhone** por cabo, confie no computador, selecione o device no topo e clique em **Run (▶)**.
   - No iPhone: Ajustes ▸ Geral ▸ VPN e Gerenciamento de Dispositivos ▸ confie no seu certificado de
     desenvolvedor (necessário na 1ª vez com Apple ID grátis; o app expira em ~7 dias no plano grátis).

## 5. Distribuir para a equipe (opcional — precisa do Apple Developer Program)

- **TestFlight (recomendado p/ uso interno dos ~30 colaboradores):**
  1. Em [App Store Connect](https://appstoreconnect.apple.com) crie o app (mesmo Bundle ID).
  2. No Xcode: **Product ▸ Archive** → **Distribute App ▸ App Store Connect ▸ Upload**.
  3. No App Store Connect, aba **TestFlight**, adicione testadores (internos = instantâneo; externos
     passam por uma revisão leve).
- **App Store público:** mesma subida + envio para revisão. ⚠️ Apps que são só "wrapper" de site
  podem ser barrados pela diretriz 4.2 da Apple; para uso interno, prefira TestFlight.

## Atualizações

Como o app carrega o site do Vercel (`server.url`), **mudanças no front-end aparecem sozinhas** ao
abrir o app — não precisa gerar build novo. Só refaça o build iOS quando mudar ícone, permissões,
plugins nativos ou a versão da loja.
