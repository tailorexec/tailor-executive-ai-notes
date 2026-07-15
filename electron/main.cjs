// Processo principal do app Windows (Electron). Wrapper FINO: carrega o site publicado ao
// vivo (mesmo padrao do APK Android via Capacitor, que aponta pra server.url) -- correcoes e
// features novas do site chegam sozinhas, sem precisar gerar/redistribuir um instalador novo.
// So o que precisa mesmo de codigo nativo vive aqui: atalho global e captura de audio do
// sistema sem o dialogo de escolha do SO.

const { app, BrowserWindow, Tray, Menu, globalShortcut, session, desktopCapturer, nativeImage, dialog, ipcMain, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log/main')
const path = require('node:path')

const APP_URL = 'https://tailor-executive-ai-notes.vercel.app'
const RECORD_HOTKEY = 'CommandOrControl+Shift+G'
const ICON_PATH = path.join(__dirname, '..', 'build', 'icon.ico')

// Grava em arquivo (userData/logs/main.log) -- sem isto, um "buscar atualizacoes" que nao
// mostra nada nunca deixa rastro nenhum pra investigar. Se acontecer de novo, pedir esse
// arquivo pro usuario mostra exatamente onde a checagem parou (rede, GitHub, parse do
// latest.yml, etc.) em vez de adivinhar as cegas.
log.initialize()
log.transports.file.level = 'info'
autoUpdater.logger = log

// So baixa a atualizacao se o usuario confirmar (dialog abaixo) -- nunca baixa/instala sozinho
// sem avisar, ja que o instalador nao e assinado e o Windows sempre vai pedir confirmacao.
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

log.info(`ANA iniciando -- versao ${app.getVersion()}, plataforma ${process.platform}`)

let mainWindow = null
let tray = null

/**
 * Sem isto, clicar no atalho do app de novo enquanto ele ja esta rodando (minimizado na
 * bandeja -- o usuario so achou que tinha fechado) abre um SEGUNDO processo, que disputa com o
 * primeiro o mesmo arquivo de sessao local no disco. O segundo processo perde essa disputa e
 * abre "deslogado" mesmo com uma sessao valida gravada -- e exatamente o bug de "fechar o app
 * desconecta a conta" relatado, so que o gatilho real e abrir de novo, nao fechar.
 * requestSingleInstanceLock() garante que so existe UM processo: uma segunda tentativa de
 * abrir so foca a janela do processo original, sem nunca competir pelo mesmo storage.
 */
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  // Uma segunda tentativa de abrir (usuario clicou no atalho de novo) so foca a janela que ja
  // existe -- nunca cria um segundo processo.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else {
      createWindow()
    }
  })

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      minWidth: 960,
      minHeight: 640,
      icon: ICON_PATH,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        // Particao NOMEADA e persistente (gravada em disco no userData) em vez de depender do
        // "default session" implicito -- deixa explicito que login/localStorage devem sobreviver
        // a fechar e reabrir o app, em vez de confiar no comportamento padrao do Electron.
        partition: 'persist:ana',
      },
    })

    mainWindow.loadURL(APP_URL)

    // Fechar a janela minimiza pra bandeja em vez de encerrar o processo -- e o que permite o
    // atalho global funcionar mesmo com a janela "fechada" (o usuario so quis tirar da tela).
    mainWindow.on('close', (event) => {
      if (app.isQuitting) return
      event.preventDefault()
      mainWindow.hide()
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  /** Traz a janela pra frente e avisa o site (via preload) que o atalho de gravar foi pressionado. */
  function triggerRecordHotkey() {
    if (!mainWindow) {
      createWindow()
      mainWindow.webContents.once('did-finish-load', () => mainWindow.webContents.send('ana:hotkey-record'))
      return
    }
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('ana:hotkey-record')
  }

  function createTray() {
    // Defensivo: se por algum motivo isto rodar de novo com uma tray ja existente, destroi a
    // antiga antes -- nunca deixa duas ativas ao mesmo tempo no mesmo processo.
    if (tray) {
      tray.destroy()
      tray = null
    }
    let icon = nativeImage.createFromPath(ICON_PATH)
    if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 })
    tray = new Tray(icon)
    tray.setToolTip('ANA by Tailor')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Abrir ANA', click: () => (mainWindow ? mainWindow.show() : createWindow()) },
        { label: 'Gravar reunião (Ctrl+Shift+G)', click: triggerRecordHotkey },
        { type: 'separator' },
        { label: 'Buscar atualizações...', click: () => checkForUpdates(true) },
        { label: 'Abrir pasta de logs...', click: () => shell.showItemInFolder(log.transports.file.getFile().path) },
        { type: 'separator' },
        {
          label: 'Sair',
          click: () => {
            app.isQuitting = true
            app.quit()
          },
        },
      ]),
    )
    tray.on('click', () => (mainWindow ? mainWindow.show() : createWindow()))
  }

  /**
   * Manda o status pro site (icone de atualizar em Home.tsx) alem dos dialogos nativos --
   * sem isto, clicar em "buscar atualizacoes" nao dava NENHUM feedback visivel ate um dialogo
   * eventualmente aparecer (ou nunca aparecer, se ja estivesse atualizado), parecendo que o
   * botao nao fez nada.
   */
  function sendUpdateStatus(payload) {
    if (mainWindow) mainWindow.webContents.send('ana:update-status', payload)
  }

  /**
   * Checagem de atualizacao via GitHub Releases (mesmo repositorio, configurado em
   * package.json's build.publish). `manual` distingue quem clicou em "Buscar atualizacoes"
   * (sempre mostra um resultado, mesmo "ja esta atualizado") da checagem automatica silenciosa
   * do startup (so incomoda o usuario quando ha novidade de verdade) -- por isso so os eventos
   * de "checando"/"sem novidade" respeitam esse filtro; "achou"/"baixando"/"pronto" o site sempre
   * mostra, ja que nesse ponto ha algo real acontecendo (e o dialogo nativo tambem aparece nos 2 casos).
   */
  let checkingUpdate = false
  let lastCheckWasManual = false
  function checkForUpdates(manual) {
    log.info(`checkForUpdates chamado (manual=${manual}, ja em andamento=${checkingUpdate})`)
    if (checkingUpdate) return
    checkingUpdate = true
    lastCheckWasManual = manual
    if (manual) sendUpdateStatus({ status: 'checking' })
    autoUpdater
      .checkForUpdates()
      .catch((err) => {
        log.error('checkForUpdates falhou:', err)
        if (manual) {
          sendUpdateStatus({ status: 'error', message: String(err?.message ?? err) })
          dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'Buscar atualizações',
            message: 'Não foi possível verificar atualizações agora.',
            detail: String(err?.message ?? err),
          })
        }
      })
      .finally(() => {
        checkingUpdate = false
      })
  }

  // Pedido vindo do site (icone no topo, ao lado de pasta/tema -- ver src/lib/electron.ts +
  // preload.cjs): mesmo comportamento do item de menu da bandeja.
  ipcMain.on('ana:check-for-updates', () => {
    log.info('IPC ana:check-for-updates recebido do site')
    checkForUpdates(true)
  })

  autoUpdater.on('update-available', (info) => {
    log.info('update-available:', info.version)
    sendUpdateStatus({ status: 'available', version: info.version })
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização disponível',
        message: `Uma nova versão (${info.version}) está disponível. Baixar agora?`,
        detail: 'O app continua funcionando normalmente enquanto baixa em segundo plano.',
        buttons: ['Baixar agora', 'Agora não'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) {
          autoUpdater.downloadUpdate()
        } else {
          // Usuario recusou baixar agora -- sem isto, o icone de "buscando atualizacao" do site
          // ficava girando pra sempre, ja que nenhum evento de download nunca chegaria.
          sendUpdateStatus({ status: 'cancelled' })
        }
      })
  })

  autoUpdater.on('update-not-available', (info) => {
    log.info('update-not-available (versao atual ja e a mais nova):', info?.version)
    if (lastCheckWasManual) {
      sendUpdateStatus({ status: 'not-available' })
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Buscar atualizações',
        message: 'Você já está usando a versão mais recente.',
      })
    }
  })

  autoUpdater.on('download-progress', (p) => {
    if (mainWindow) mainWindow.setProgressBar(p.percent / 100)
    sendUpdateStatus({ status: 'downloading', percent: p.percent })
  })

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.setProgressBar(-1)
    sendUpdateStatus({ status: 'downloaded', version: info.version })
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Atualização pronta',
        message: `A versão ${info.version} foi baixada. Reiniciar agora para instalar?`,
        buttons: ['Reiniciar agora', 'Depois'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((r) => {
        if (r.response === 0) {
          app.isQuitting = true
          autoUpdater.quitAndInstall()
        }
      })
  })

  app.whenReady().then(() => {
    // Autoriza getDisplayMedia() (usado pelo "Gravar Meet" do site) SEM o dialogo de escolha
    // do sistema operacional: grava a tela toda + audio do sistema (loopback) direto. Resolve o
    // maior ponto de atrito da gravacao de reuniao (escolher a aba certa, lembrar de marcar
    // "compartilhar audio") -- so acontece aqui dentro do app nativo, um navegador comum sempre
    // exige esse dialogo por seguranca. Tem que ser na MESMA particao da janela (persist:ana),
    // senao o handler fica registrado numa sessao que a janela nem usa.
    session.fromPartition('persist:ana').setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer
          .getSources({ types: ['screen'] })
          .then((sources) => callback({ video: sources[0], audio: 'loopback' }))
          .catch(() => callback({}))
      },
      { useSystemPicker: false },
    )

    createWindow()
    createTray()

    const registered = globalShortcut.register(RECORD_HOTKEY, triggerRecordHotkey)
    if (!registered) {
      // Outro programa ja usa este atalho no Windows do usuario -- nao trava o app por isso,
      // so fica sem o atalho global (a bandeja/menu ainda funcionam).
      console.warn(`Nao foi possivel registrar o atalho ${RECORD_HOTKEY} (em uso por outro app).`)
    }

    // Checagem automatica e silenciosa ao abrir (so incomoda se houver novidade de verdade;
    // "ja esta atualizado" nao aparece aqui, so quando o usuario pede pelo menu da bandeja).
    setTimeout(() => checkForUpdates(false), 5000)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    app.isQuitting = true
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    // Sem isto, o Windows deixava o icone "fantasma" na bandeja depois de fechar (o Electron
    // nao remove sozinho) -- so sumia de vez ao passar o mouse em cima ou reiniciar o Explorer.
    if (tray) {
      tray.destroy()
      tray = null
    }
  })

  // Continua rodando na bandeja no Windows mesmo com todas as janelas fechadas -- so encerra
  // mesmo via "Sair" no menu da bandeja (app.isQuitting).
  app.on('window-all-closed', () => {})
}
