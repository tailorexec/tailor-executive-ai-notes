; Script NSIS customizado, incluido pelo electron-builder (nsis.include em package.json).
;
; O ANA fica na BANDEJA do Windows: fechar a janela so ESCONDE o app -- o processo continua
; vivo (ver electron/main.cjs: requestSingleInstanceLock + o handler de 'close' que faz hide).
; Por isso o instalador nao consegue "fechar" o app sozinho e trava no dialogo "Nao e possivel
; fechar o ANA by Tailor... clique em Repetir". Aqui encerramos o processo A FORCA logo no
; inicio da instalacao (antes de copiar/sobrescrever os arquivos, que e onde ele fica travado),
; tanto na atualizacao manual quanto pelo auto-updater.
!macro customInit
  nsExec::Exec 'taskkill /F /T /IM "ANA by Tailor.exe"'
  Sleep 1200
!macroend
