// Find the most recent archived snapshot and compare it against docs/perf-latest.json
// Usage: node scripts/perf-check.mjs [--threshold=0.10]

import { readdirSync, statSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

function load(path) { return JSON.parse(readFileSync(path, 'utf8')) }

function pct(a, b) { return (a - b) / b }

function fmtPct(x) { return (x * 100).toFixed(1) + '%' }

function main() {
  const args = process.argv.slice(2)
  const thArg = args.find(a => a.startsWith('--threshold='))
  const baseArg = args.find(a => a.startsWith('--base='))
  const useLatest = args.includes('--latest')
  const threshold = thArg ? parseFloat(thArg.split('=')[1]) : 0.10

  const latestPath = new URL('../docs/perf-latest.json', import.meta.url)
  let currentSha = ''
  try { currentSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}

  const histDir = new URL('../docs/perf-history/', import.meta.url)
  let files = []
  try { files = readdirSync(histDir).filter(f => f.endsWith('.json')) } catch {}
  if (!files.length) {
    console.log('No perf history found; skipping regression check.')
    process.exit(0)
  }
  // sort by mtime desc
  files.sort((a,b)=> statSync(join(histDir.pathname, b)).mtimeMs - statSync(join(histDir.pathname, a)).mtimeMs)
  let basePath
  if (baseArg) {
    basePath = new URL(baseArg.split('=')[1], histDir)
  } else if (useLatest) {
    basePath = new URL(files[0], histDir) // pick most recent, even if same SHA
  } else {
    const pick = files.find(f => !currentSha || !f.includes(currentSha)) || files[0]
    basePath = new URL(pick, histDir)
  }

  const cur = load(latestPath)
  const base = load(basePath)

  const curMap = new Map(cur.results.map(r => [`${r.size}-${r.scenario}`, r]))
  const baseMap = new Map(base.results.map(r => [`${r.size}-${r.scenario}`, r]))

  let regressions = 0
  for (const [k, c] of curMap.entries()) {
    const b = baseMap.get(k)
    if (!b) continue
    const oneDelta = pct(c.oneShotMs, b.oneShotMs)
    const appDelta = pct(c.appendWorkloadMs, b.appendWorkloadMs)
    if (oneDelta > threshold || appDelta > threshold) regressions++
  }

  if (regressions) {
    console.error(`Perf check failed: ${regressions} scenario(s) regressed beyond +${fmtPct(threshold)} vs ${basePath.pathname}`)
    process.exit(1)
  } else {
    console.log(`Perf check passed vs ${basePath.pathname}`)
  }
}

main()
