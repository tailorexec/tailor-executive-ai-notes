; Script NSIS customizado. Fica em build/installer.nsh: e o caminho PADRAO que o electron-builder
; inclui automaticamente (getResource com include indefinido -> buildResources/installer.nsh).
;
; PROBLEMA: o ANA fica na BANDEJA do Windows -- fechar a janela so ESCONDE o app (o processo
; continua vivo, ver electron/main.cjs). A checagem padrao do electron-builder
; (_CHECK_APP_RUNNING) detecta o app rodando e, quando NAO e um update "in-place", abre o
; dialogo "Nao e possivel fechar o ANA by Tailor... clique em Repetir" -- que trava o usuario.
;
; SOLUCAO: `customCheckAppRunning` e um hook que, quando definido, SUBSTITUI toda a checagem
; padrao (incluindo o dialogo). Aqui simplesmente encerramos o processo a forca e seguimos --
; sem dialogo nenhum. ${APP_EXECUTABLE_FILENAME} e o nome exato do .exe definido pelo
; electron-builder ("ANA by Tailor.exe"), entao o taskkill sempre bate no processo certo.
!macro customCheckAppRunning
  nsExec::Exec 'cmd.exe /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  ; da tempo do Windows liberar os handles do .exe antes de sobrescrever
  Sleep 2000
!macroend

; Reforco: mata o processo tambem no inicio (onInit), antes de qualquer copia de arquivo.
!macro customInit
  nsExec::Exec 'cmd.exe /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"'
  Sleep 1000
!macroend
