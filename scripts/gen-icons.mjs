// Gera os icones PWA a partir da marca Tailor (alfinete vermelho em fundo ink).
// Uso: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
mkdirSync(pub, { recursive: true })

// Icone padrao (com fundo, cantos arredondados via viewport quadrado).
const iconSvg = (size, radius) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="#010101"/>
  <circle cx="256" cy="180" r="78" fill="none" stroke="#F10C27" stroke-width="40"/>
  <path d="M256 246 L312 368 L256 470 L200 368 Z" fill="#F10C27"/>
</svg>`

// Versao maskable: mesma arte com mais respiro (safe area).
const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#010101"/>
  <circle cx="256" cy="205" r="62" fill="none" stroke="#F10C27" stroke-width="32"/>
  <path d="M256 258 L300 356 L256 438 L212 356 Z" fill="#F10C27"/>
</svg>`

const targets = [
  { file: 'pwa-192.png', size: 192, svg: iconSvg(512, 96) },
  { file: 'pwa-512.png', size: 512, svg: iconSvg(512, 96) },
  { file: 'pwa-maskable-512.png', size: 512, svg: maskableSvg },
  { file: 'apple-touch-icon.png', size: 180, svg: iconSvg(512, 0) },
  { file: 'favicon-48.png', size: 48, svg: iconSvg(512, 96) },
]

for (const t of targets) {
  await sharp(Buffer.from(t.svg)).resize(t.size, t.size).png().toFile(join(pub, t.file))
  console.log('gerado', t.file)
}
console.log('OK')
