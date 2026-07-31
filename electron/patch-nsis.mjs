// Deixa o instalador NSIS (electron-builder) mais PACIENTE ao copiar os arquivos do app.
//
// PROBLEMA: numa instalacao limpa, o Windows Defender escaneia o .exe recem-extraido (~125MB, e
// o app NAO e assinado) e o segura por alguns segundos. O template do electron-builder tenta
// copiar 5 vezes (5s) e, se ainda travado, mostra o dialogo "Repetir" ("$(appCannotBeClosed)").
// Como o Defender esta em todo Windows, isso acontece com praticamente todo mundo no meio da
// instalacao manual. (No auto-update e silencioso -- o /SD IDRETRY clica "Repetir" sozinho -- por
// isso la nao aparece.)
//
// SOLUCAO (paliativa, ate assinarmos o instalador): sobe o numero de tentativas de 5 -> 30 (~30s),
// dando tempo do Defender liberar o arquivo ANTES de incomodar o usuario. A extracao ja tem um
// overwrite de ultimo recurso depois disso, entao nunca trava de vez. Roda no predist:win /
// prerelease:win (o CI faz `npm ci` e depois `npm run dist:win`, entao o patch e reaplicado sempre
// sobre o node_modules fresco). Idempotente.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FILES = [
  'node_modules/app-builder-lib/templates/nsis/include/extractAppPackage.nsh',
  'node_modules/app-builder-lib/templates/nsis/include/installUtil.nsh',
]
const RETRIES = 30

let changed = 0
for (const f of FILES) {
  if (!existsSync(f)) {
    console.warn(`patch-nsis: ${f} nao encontrado (template mudou?) -- pulando`)
    continue
  }
  const before = readFileSync(f, 'utf8')
  const after = before.replace(/\$\{if\} \$R1 < 5\b/g, `\${if} $R1 < ${RETRIES}`)
  if (after !== before) {
    writeFileSync(f, after)
    changed++
    console.log(`patch-nsis: ${f} -> tentativas de copia 5 => ${RETRIES}`)
  }
}
if (!changed) console.log('patch-nsis: nada a alterar (ja aplicado ou template diferente)')
