# Gerar o app Windows (Electron)

O app Windows (Electron) **carrega o site publicado** (https://tailor-executive-ai-notes.vercel.app),
o mesmo padrao do APK Android. Assim, cada deploy web atualiza o app automaticamente -- voce so
precisa gerar o instalador de novo se mudar algo NATIVO: o atalho global, a captura de audio do
sistema, o icone ou o nome do app (arquivos em `electron/`).

## 1. Gerar o instalador localmente

```
npm install
npm run dist:win
```

O instalador sai em `release/ANA-by-Tailor-Setup-<versao>.exe` (a versao vem do campo `version`
do `package.json` -- mantenha igual a `src/lib/version.ts`). Sem espaco no nome de proposito
(`nsis.artifactName` em package.json) -- com espaco, o GitHub troca por ponto ao subir o asset,
e isso NAO bate com o nome que `latest.yml` espera (gerado sem espaco), quebrando o auto-update
em silencio (aconteceu uma vez, ver historico do commit `feat(windows): busca e instala...`).

## 2. Testar sem empacotar (mais rapido, ao editar `electron/`)

```
npm run electron:dev
```

Abre a janela do Electron carregando o site ao vivo, sem gerar o instalador.

## 3. Gerar pelo GitHub Actions (sem precisar do Windows local)

Aba **Actions → Build Windows App → Run workflow** no GitHub. O instalador fica disponivel como
artefato do workflow (`ana-windows-setup`).

## O que o app nativo faz alem do site

- **Atalho global `Ctrl+Shift+G`**: traz a janela pra frente e abre a tela de gravar reuniao
  (`electron/main.cjs` + `src/lib/electron.ts` + `App.tsx`). Falta 1 clique em "Iniciar" -- o
  navegador exige um gesto real do usuario para pedir microfone, entao esse ultimo passo nao da
  para automatizar.
- **Captura de audio do sistema sem dialogo**: dentro do app nativo, "Gravar Meet" nao pede pra
  escolher a aba nem lembrar de marcar "compartilhar audio" -- `setDisplayMediaRequestHandler` no
  processo principal autoriza tela inteira + audio do sistema direto. Isso so funciona AQUI, nao
  no navegador comum (por seguranca, o navegador sempre mostra esse dialogo).
- **Bandeja do sistema**: fechar a janela minimiza para a bandeja em vez de encerrar o app (o
  atalho global continua funcionando com a janela "fechada"). "Sair" no menu da bandeja encerra
  de verdade.
- **Busca atualizacoes sozinho** (`electron-updater`): checa 5s apos abrir (silencioso, so avisa
  se houver novidade) e pelo item "Buscar atualizacoes..." no menu da bandeja (sempre mostra um
  resultado). So baixa/instala com confirmacao do usuario (`autoDownload = false`). Le a config
  de `package.json`'s `build.publish` (provider github, mesmo repositorio das releases).

## Publicar uma release (checklist -- os 3 primeiros SAO OBRIGATORIOS pro auto-update funcionar)

Depois de `npm run dist:win`, a pasta `release/` tem os arquivos que precisam ir TODOS pra
mesma release do GitHub:

1. `ANA-by-Tailor-Setup-<versao>.exe` (o instalador em si, nome com versao)
2. `ANA-by-Tailor-Setup-<versao>.exe.blockmap` (permite update diferencial, so baixa o que mudou)
3. `latest.yml` (o que `electron-updater` le pra saber que ha versao nova e onde baixar)
4. Uma copia do `.exe` renomeada pra `ANA-Tailor-Setup-Windows.exe` (nome FIXO, sem versao --
   e o link usado no site/app, `src/lib/windowsApp.ts`, via `releases/latest/download/...`)
5. O `.apk` do Android (se tambem foi gerado nesta rodada), renomeado pra `ANA-Tailor-Android.apk`

Faltar os itens 1-3 nao quebra o download manual (item 4 continua funcionando), mas quebra o
auto-update em silencio: o app vai detectar que ha uma versao nova, tentar baixar, e falhar
(404) sem avisar nada de util no dialogo de erro alem de "nao foi possivel verificar".

## Assinatura de codigo (NAO configurada)

O instalador gerado **nao e assinado digitalmente** -- o Windows SmartScreen vai avisar "Editor
desconhecido" no primeiro uso (o usuario clica em "Mais informacoes" → "Executar assim mesmo").
Isso e equivalente ao APK sem keystore configurado: funciona, so pede essa confirmacao extra.
Para remover esse aviso e preciso comprar um certificado de assinatura de codigo (Authenticode,
~200-400 USD/ano) e configurar as variaveis `CSC_LINK`/`CSC_KEY_PASSWORD` do electron-builder --
nao fiz isso aqui por ser um custo recorrente que so voce pode decidir assumir.

## Icone

Gerado a partir de `assets/icon.png` (mesmo usado no Android/PWA) via `npm run electron:icon`,
que produz `build/icon.ico` (nao versionado -- roda sozinho antes de `dist:win`/`electron:dev`).
Para trocar o icone do app, so trocar `assets/icon.png` e gerar de novo.

## Observacoes

- Instalador pesa ~120 MB: e o preco do Electron (embute Chromium + Node), bem maior que o APK
  Android (que reaproveita a WebView do sistema). Nao ha como reduzir isso sem trocar de
  tecnologia (ex.: Tauri, que usa o WebView2 do Windows em vez de empacotar o Chromium).
- Como o app so carrega o site, ele nao funciona sem internet -- igual ao uso normal do ANA hoje.
- `package.json`'s `"main"` aponta para `electron/main.cjs`; isso nao afeta `npm run dev`/`build`
  (Vite ignora esse campo).
