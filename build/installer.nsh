; Script NSIS customizado (build/installer.nsh e o caminho PADRAO que o electron-builder inclui
; sozinho -- confirmado no fonte: getResource(undefined,"installer.nsh") -> buildResources/).
;
; PROBLEMA: o ANA fica na BANDEJA -- fechar a janela so ESCONDE, o processo continua vivo. O
; instalador nao consegue fechar o app e trava no dialogo "Nao e possivel fechar o ANA by
; Tailor... clique em Repetir".
;
; SOLUCAO: encerrar o processo A FORCA. As tentativas anteriores usavam `nsExec::Exec 'cmd.exe
; /c taskkill ...'` (aspas simples + cmd.exe pelo PATH), que aparentemente nao executava no
; ambiente do instalador. Aqui uso o MESMO padrao do proprio electron-builder (KILL_PROCESS):
; caminho ABSOLUTO ($SYSDIR\taskkill.exe) e BACKTICKS como delimitador (as aspas duplas internas
; passam literais). /IM sozinho ja mata TODOS os processos com esse nome (o Electron cria varios
; helpers com o mesmo nome), entao nao precisa de /T.
!macro _AnaForceKill
  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $0
  ; da tempo do Windows liberar os handles do .exe antes de sobrescrever os arquivos
  Sleep 2000
!macroend

; Substitui TODA a checagem padrao (incluindo o dialogo): so mata e segue.
!macro customCheckAppRunning
  !insertmacro _AnaForceKill
!macroend

; Reforco: mata tambem logo no inicio (onInit), antes de qualquer copia de arquivo.
!macro customInit
  !insertmacro _AnaForceKill
!macroend
