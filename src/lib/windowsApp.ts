// Download do app Windows (Electron) -- hospedado como asset de release no GitHub (o instalador
// tem ~120MB, acima do limite de upload do Supabase Storage no plano atual). O nome do arquivo
// e fixo (sem a versao) de proposito: `releases/latest/download/<nome>` sempre resolve pro
// arquivo da ULTIMA release publicada, sem precisar trocar este link a cada nova versao --
// so exige que `npm run dist:win` + `gh release upload` usem sempre este mesmo nome de arquivo.
export const WINDOWS_APP_DOWNLOAD_URL =
  'https://github.com/tailorexec/tailor-executive-ai-notes/releases/latest/download/ANA-Tailor-Setup-Windows.exe'
