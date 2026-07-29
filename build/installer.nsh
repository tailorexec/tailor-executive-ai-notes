; Script NSIS customizado (build/installer.nsh e o caminho PADRAO que o electron-builder inclui
; sozinho -- confirmado no fonte: getResource(undefined,"installer.nsh") -> buildResources/).
;
; PROBLEMA: o ANA fica na BANDEJA e o Electron cria varios processos com o mesmo nome
; ("ANA by Tailor.exe": principal + helpers). No auto-update o app chama quitAndInstall, mas os
; processos ainda estao MORRENDO no instante em que o instalador comeca a extrair -> a extracao
; pega um arquivo ainda travado e o Windows mostra o erro "arquivo em uso / Repetir" (clicar em
; Repetir funciona porque ai ja morreu, mas queremos que nem apareca).
;
; SOLUCAO: nao basta "matar e seguir" -- tem que MATAR e ESPERAR sumir de verdade antes de extrair.
; taskkill /F /IM retorna 0 enquanto ainda ha algum processo com esse nome pra matar; quando nao
; acha mais nada, retorna != 0. Entao repetimos ate dar "nada pra matar" e damos um respiro pros
; handles do .exe serem liberados. Caminho ABSOLUTO ($SYSDIR\taskkill.exe) + backticks (o mesmo
; padrao do KILL_PROCESS interno do electron-builder). O parametro UID deixa os labels unicos, ja
; que a macro e inserida em dois pontos (customInit e customCheckAppRunning).
!macro _AnaKillWait UID
  StrCpy $R0 0
  ana_loop_${UID}:
    nsExec::Exec `"$SYSDIR\taskkill.exe" /F /IM "${APP_EXECUTABLE_FILENAME}"`
    Pop $0
    ; $0 == "0" -> matou algo (pode haver mais/helpers) -> espera e tenta de novo.
    ; $0 != "0" -> nao ha mais processo -> sai do loop.
    StrCmp $0 "0" "" ana_gone_${UID}
    Sleep 400
    IntOp $R0 $R0 + 1
    ; trava de seguranca: no maximo ~6s de espera (15 x 400ms) pra nunca pendurar o instalador.
    IntCmp $R0 15 ana_gone_${UID} ana_loop_${UID} ana_gone_${UID}
  ana_gone_${UID}:
  ; respiro final pros handles do arquivo serem liberados antes de sobrescrever.
  Sleep 800
!macroend

; Substitui TODA a checagem padrao (incluindo o dialogo): mata e ESPERA sumir antes de extrair.
!macro customCheckAppRunning
  !insertmacro _AnaKillWait CHECK
!macroend

; Reforco: mata tambem logo no inicio (onInit), antes de qualquer copia de arquivo.
!macro customInit
  !insertmacro _AnaKillWait INIT
!macroend
