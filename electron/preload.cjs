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
})
