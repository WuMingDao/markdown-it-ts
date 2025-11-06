#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

function getShortSHA() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    if (sha) return sha
  } catch {}
  const now = new Date()
  const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `no-git-${stamp}`
}

function main() {
  const latestPath = join(process.cwd(), 'docs', 'perf-latest.json')
  if (!existsSync(latestPath)) {
    console.error('perf-accept: docs/perf-latest.json not found. Run `pnpm run perf:generate` first.')
    process.exit(1)
  }
  const sha = getShortSHA()
  const outDir = join(process.cwd(), 'docs', 'perf-history')
  const outPath = join(outDir, `perf-${sha}.json`)
  mkdirSync(outDir, { recursive: true })
  const buf = readFileSync(latestPath)
  writeFileSync(outPath, buf)
  console.log(`Accepted latest perf snapshot as baseline: ${outPath}`)
}

main()
