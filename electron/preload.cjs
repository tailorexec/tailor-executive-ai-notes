// Ponte segura entre o processo principal (Node/Electron) e o site carregado na janela.
// contextIsolation fica ligado (main.cjs) -- o site nunca ganha acesso direto a Node/IPC,
// so a este objeto explicito e minimo, do jeito que o Electron recomenda.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('anaElectron', {
  platform: 'win32',
  /** Chama `cb` quando o atalho global de gravar (Ctrl+Shift+G) e pressionado. Devolve uma
   *  funcao para cancelar a inscricao (mesmo padrao de um addEventListener/useEffect). */
  onRecordHotkey(cb) {
    const listener = () => cb()
    ipcRenderer.on('ana:hotkey-record', listener)
    return () => ipcRenderer.removeListener('ana:hotkey-record', listener)
  },
  /** Pede pro processo principal checar atualizacoes agora (sempre mostra um resultado,
   *  mesmo "ja esta atualizado" -- o dialogo nativo aparece do lado do main.cjs). */
  checkForUpdates() {
    ipcRenderer.send('ana:check-for-updates')
  },
  /** Chama `cb` a cada mudanca de status da checagem/download de atualizacao (checando,
   *  achou, sem novidade, baixando com %, pronto, erro) -- da o feedback visivel que o
   *  dialogo nativo sozinho nao cobre (ex.: nada aparece enquanto so esta checando). */
  onUpdateStatus(cb) {
    const listener = (_event, payload) => cb(payload)
    ipcRenderer.on('ana:update-status', listener)
    return () => ipcRenderer.removeListener('ana:update-status', listener)
  },
})
