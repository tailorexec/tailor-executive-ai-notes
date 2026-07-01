# Gerar o APK do TENA (Android)

O app Android (Capacitor) **carrega o site publicado** (https://tailor-executive-ai-notes.vercel.app).
Assim, cada deploy web atualiza o app automaticamente — voce so precisa gerar o APK de novo se mudar
algo nativo (permissoes, icone, nome).

## 1. Abrir no Android Studio
- Abra o Android Studio → **Open** → selecione a pasta `android` deste projeto.
- Na primeira vez, ele vai baixar o **Android SDK** e sincronizar o Gradle (aceite as licencas). Aguarde terminar.

## 2. Gerar o APK de teste (mais rapido, ja instalavel)
- Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
- Ao terminar, clique em **locate**: o arquivo fica em
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- Esse `.apk` ja instala em qualquer Android (ative "Instalar apps de fontes desconhecidas").

## 3. (Opcional) APK assinado para distribuicao ampla
- Menu **Build → Generate Signed Bundle / APK → APK**.
- Crie um **keystore** (guarde bem a senha; sera usado sempre para atualizar o app).
- Escolha **release** e finalize. O `.apk` assinado sai em `android/app/release/`.

## 4. Distribuir por link
- Suba o `.apk` em um link (Drive, site, ou eu posso hospedar no Supabase Storage e gerar um link publico).
- No celular, baixe e instale (permita fontes desconhecidas).

## Observacoes
- **Microfone**: as permissoes ja estao no manifesto. Na primeira gravacao o Android pede autorizacao.
- **Captura de audio interno no celular** (som de outros apps/reuniao) NAO vem por padrao na WebView; e um
  recurso nativo adicional para uma proxima fase (no desktop web ja funciona).
- Para mudar nome/icone/appId: `capacitor.config.ts` e os recursos em `android/app/src/main/res`.
- Depois de qualquer mudanca no site, rode `npm run build` e `npx cap sync android` (so necessario se um dia
  voce trocar para o modo "offline"; no modo atual com server.url nao precisa).
