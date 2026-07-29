// Download do app Windows (Electron) -- hospedado como asset de release no GitHub (o instalador
// tem ~120MB, acima do limite de upload do Supabase Storage no plano atual).
//
// Apontamos pro asset VERSIONADO da release (nome com a versao), pra que o arquivo baixado ja
// venha identificado -- ex.: "ANA-by-Tailor-Setup-0.18.29.exe" -- tanto pelo site quanto no GitHub.
// Como LATEST_WINDOWS_BUILD e bumpado JUNTO com cada release publicada, a URL sempre casa com uma
// release existente (releases antigas nao sao apagadas, entao nunca da 404). O asset de nome fixo
// (ANA-Tailor-Setup-Windows.exe) continua sendo publicado como fallback, mas o link do app usa a
// versao pra deixar claro o que se esta baixando.
import { LATEST_WINDOWS_BUILD } from './version'

const REPO = 'https://github.com/tailorexec/tailor-executive-ai-notes'

/** Nome do instalador baixado (com a versao) -- igual ao `nsis.artifactName` do package.json. */
export const WINDOWS_APP_FILENAME = `ANA-by-Tailor-Setup-${LATEST_WINDOWS_BUILD}.exe`

export const WINDOWS_APP_DOWNLOAD_URL = `${REPO}/releases/download/v${LATEST_WINDOWS_BUILD}/${WINDOWS_APP_FILENAME}`
