// Gera build/icon.ico a partir do icone-fonte de alta resolucao (mesmo usado no Android/PWA),
// para o instalador do Windows (electron-builder exige um .ico, nao aceita PNG direto).
// Rodar de novo so se o icone do app mudar: `npm run electron:icon`.

import { fileURLToPath } from 'node:url'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import pngToIco from 'png-to-ico'

const srcPath = fileURLToPath(new URL('../assets/icon.png', import.meta.url))
const outDir = fileURLToPath(new URL('../build/', import.meta.url))
const outPath = fileURLToPath(new URL('../build/icon.ico', import.meta.url))

if (!existsSync(outDir)) await mkdir(outDir, { recursive: true })
const buf = await pngToIco(srcPath)
await writeFile(outPath, buf)
console.log('build/icon.ico gerado a partir de assets/icon.png')
