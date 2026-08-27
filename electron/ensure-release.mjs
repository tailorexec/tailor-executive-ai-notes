// Cria o release no GitHub ANTES do electron-builder publicar.
//
// PROBLEMA: o electron-builder sobe os artefatos em publishers PARALELOS (um por arquivo) e cada
// um tenta criar o release da tag. Um ganha, o outro leva "422 Validation Failed" e MORRE levando
// junto o arquivo que ele carregava. Aconteceu nas tres publicacoes seguidas:
//   v0.18.33 -> criou release duplicado (rascunho) e dividiu os arquivos entre os dois
//   v0.18.34 -> subiu so o .exe; ficou SEM latest.yml
//   v0.18.35 -> subiu so o .blockmap; ficou sem o .exe
// Um release sem latest.yml e o pior caso: o auto-update de TODOS para de enxergar versao nova.
//
// SOLUCAO: com o release ja existente, nenhum publisher precisa cria-lo -- os dois so anexam
// arquivos, e a corrida deixa de existir. Idempotente: se a tag ja existe, nao faz nada.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const tag = `v${version}`
const repo = 'tailorexec/tailor-executive-ai-notes'

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

try {
  gh(['release', 'view', tag, '--repo', repo, '--json', 'id'])
  console.log(`ensure-release: ${tag} ja existe -- nada a fazer`)
} catch {
  try {
    gh(['release', 'create', tag, '--repo', repo, '--title', `ANA by Tailor ${tag}`, '--notes', 'Publicando...'])
    console.log(`ensure-release: ${tag} criado (o electron-builder so vai anexar os arquivos)`)
  } catch (err) {
    // Sem gh/sem login o build ainda funciona -- so volta a correr o risco da corrida.
    console.warn(`ensure-release: nao foi possivel criar ${tag} (${err.message.split('\n')[0]}).`)
    console.warn('ensure-release: siga o build, mas CONFIRA no fim se o release tem .exe, .blockmap e latest.yml.')
  }
}
