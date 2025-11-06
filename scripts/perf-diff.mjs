#!/usr/bin/env node
// Show detailed deltas between docs/perf-latest.json and a chosen baseline in docs/perf-history
// Usage: node scripts/perf-diff.mjs [--threshold=0.10]
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const args = process.argv.slice(2)
const thArg = args.find(a => a.startsWith('--threshold='))
const threshold = thArg ? parseFloat(thArg.split('=')[1]) : 0.10

function load(p){ return JSON.parse(readFileSync(p, 'utf8')) }
function pct(a,b){ return (a-b)/b }
function fmt(x){ return (x*100).toFixed(1)+'%' }

const latestPath = new URL('../docs/perf-latest.json', import.meta.url)
const histDir = new URL('../docs/perf-history/', import.meta.url)
let files = []
try { files = readdirSync(histDir).filter(f=>f.endsWith('.json')) } catch {}
if (!files.length){
  console.error('No perf history found. Run `pnpm run perf:generate` to create docs/perf-latest.json and `pnpm run perf:accept` to archive a baseline.')
  process.exit(1)
}
files.sort((a,b)=> statSync(join(histDir.pathname, b)).mtimeMs - statSync(join(histDir.pathname, a)).mtimeMs)
let currentSha = ''
try { currentSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore','pipe','ignore'] }).toString().trim() } catch {}
const pick = files.find(f => !currentSha || !f.includes(currentSha)) || files[0]
const basePath = new URL(pick, histDir)

const cur = load(latestPath)
const base = load(basePath)

const curMap = new Map(cur.results.map(r => [`${r.size}-${r.scenario}`, r]))
const baseMap = new Map(base.results.map(r => [`${r.size}-${r.scenario}`, r]))

const rows = []
for (const [k, c] of curMap.entries()){
  const b = baseMap.get(k)
  if (!b) continue
  const oneDelta = pct(c.oneShotMs, b.oneShotMs)
  const appDelta = pct(c.appendWorkloadMs, b.appendWorkloadMs)
  const flagged = (oneDelta > threshold) || (appDelta > threshold)
  rows.push({ key:k, size:c.size, scenario:c.scenario, one:{cur:c.oneShotMs, base:b.oneShotMs, delta:oneDelta}, app:{cur:c.appendWorkloadMs, base:b.appendWorkloadMs, delta:appDelta}, flagged })
}

rows.sort((a,b)=> Math.max(b.one.delta, b.app.delta) - Math.max(a.one.delta, a.app.delta))

const width = (s,n)=>String(s).padEnd(n)
console.log(`Comparing latest vs ${basePath.pathname} (threshold ${Math.round(threshold*100)}%)`)
console.log(width('Size',7), width('Scen',5), width('One Δ',8), width('Append Δ',10), 'One (cur/base)', 'Append (cur/base)', 'FLAG')
for (const r of rows){
  const one = fmt(r.one.delta)
  const app = fmt(r.app.delta)
  const onePair = `${r.one.cur.toFixed(3)}/${r.one.base.toFixed(3)}`
  const appPair = `${r.app.cur.toFixed(3)}/${r.app.base.toFixed(3)}`
  console.log(width(r.size,7), width(r.scenario,5), width(one,8), width(app,10), width(onePair,17), width(appPair,19), r.flagged?'!':'')
}
