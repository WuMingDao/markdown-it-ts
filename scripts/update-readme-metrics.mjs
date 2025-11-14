// Update README metric example bullets from docs/perf-latest.json
// Usage: node scripts/update-readme-metrics.mjs

import { readFileSync, writeFileSync } from 'node:fs'

const perfPath = new URL('../docs/perf-latest.json', import.meta.url)
const readmePath = new URL('../README.md', import.meta.url)

function loadJson(p) { return JSON.parse(readFileSync(p, 'utf8')) }

function formatMs(ms) { return `${ms.toFixed(2)}ms` }
function formatFx(baseline, ts) { return (baseline / ts).toFixed(1) + '×' }
function formatFrac(baseline, ts) { return (ts / baseline).toFixed(2) + '×' }

function pickBestTsBy(arr, field) {
  const tsOnly = arr.filter(r => r.scenario !== 'M1')
  return tsOnly.sort((a,b)=> a[field] - b[field])[0]
}

function getBySize(results) {
  const map = new Map()
  for (const r of results) {
    if (!map.has(r.size)) map.set(r.size, [])
    map.get(r.size).push(r)
  }
  return map
}

function buildOneExamples(bySize, sizes) {
  const lines = []
  for (const size of sizes) {
    const arr = bySize.get(size)
    if (!arr) continue
    const base = arr.find(r => r.scenario === 'M1')
    const bestTs = pickBestTsBy(arr, 'oneShotMs')
    const l = `- ${size.toLocaleString()} chars: ${formatMs(bestTs.oneShotMs)} vs ${formatMs(base.oneShotMs)} → ~${formatFx(base.oneShotMs, bestTs.oneShotMs)} faster (${formatFrac(base.oneShotMs, bestTs.oneShotMs)} time)`
    lines.push(l)
  }
  return lines
}

function buildAppendExamples(bySize, sizes) {
  const lines = []
  for (const size of sizes) {
    const arr = bySize.get(size)
    if (!arr) continue
    const base = arr.find(r => r.scenario === 'M1')
    const bestTs = pickBestTsBy(arr, 'appendWorkloadMs')
    const l = `- ${size.toLocaleString()} chars: ${formatMs(bestTs.appendWorkloadMs)} vs ${formatMs(base.appendWorkloadMs)} → ~${formatFx(base.appendWorkloadMs, bestTs.appendWorkloadMs)} faster (${formatFrac(base.appendWorkloadMs, bestTs.appendWorkloadMs)} time)`
    lines.push(l)
  }
  return lines
}

function buildRemarkOneExamples(bySize, sizes) {
  const lines = []
  for (const size of sizes) {
    const arr = bySize.get(size)
    if (!arr) continue
    const bestTs = pickBestTsBy(arr, 'oneShotMs')
    const remark = arr.find(r => r.scenario === 'R1')
    if (!remark) continue
    const l = `- ${size.toLocaleString()} chars: ${formatMs(bestTs.oneShotMs)} vs ${formatMs(remark.oneShotMs)} → ${formatFx(remark.oneShotMs, bestTs.oneShotMs)} faster`
    lines.push(l)
  }
  return lines
}

function buildRemarkAppendExamples(bySize, sizes) {
  const lines = []
  for (const size of sizes) {
    const arr = bySize.get(size)
    if (!arr) continue
    const bestTs = pickBestTsBy(arr, 'appendWorkloadMs')
    const remark = arr.find(r => r.scenario === 'R1')
    if (!remark) continue
    const l = `- ${size.toLocaleString()} chars: ${formatMs(bestTs.appendWorkloadMs)} vs ${formatMs(remark.appendWorkloadMs)} → ${formatFx(remark.appendWorkloadMs, bestTs.appendWorkloadMs)} faster`
    lines.push(l)
  }
  return lines
}

function replaceBetween(content, startTag, endTag, newLines) {
  const startIdx = content.indexOf(startTag)
  const endIdx = content.indexOf(endTag)
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return content
  const before = content.slice(0, startIdx + startTag.length)
  const after = content.slice(endIdx)
  const body = '\n' + newLines.join('\n') + '\n'
  return before + body + after
}

function main() {
  const perf = loadJson(perfPath)
  const bySize = getBySize(perf.results)

  const readme = readFileSync(readmePath, 'utf8')

  const oneSizes = [5000, 20000, 50000, 100000, 200000]
  const appendSizes = [5000, 20000, 50000, 100000, 200000]

  const oneBlock = buildOneExamples(bySize, oneSizes)
  const appBlock = buildAppendExamples(bySize, appendSizes)
  const remarkOneBlock = buildRemarkOneExamples(bySize, oneSizes)
  const remarkAppBlock = buildRemarkAppendExamples(bySize, appendSizes)

  const startOne = '<!-- perf-auto:one-examples:start -->'
  const endOne = '<!-- perf-auto:one-examples:end -->'
  const startApp = '<!-- perf-auto:append-examples:start -->'
  const endApp = '<!-- perf-auto:append-examples:end -->'
  const startRemarkOne = '<!-- perf-auto:remark-one:start -->'
  const endRemarkOne = '<!-- perf-auto:remark-one:end -->'
  const startRemarkApp = '<!-- perf-auto:remark-append:start -->'
  const endRemarkApp = '<!-- perf-auto:remark-append:end -->'

  let updated = readme
  updated = replaceBetween(updated, startOne, endOne, oneBlock)
  updated = replaceBetween(updated, startApp, endApp, appBlock)
  updated = replaceBetween(updated, startRemarkOne, endRemarkOne, remarkOneBlock)
  updated = replaceBetween(updated, startRemarkApp, endRemarkApp, remarkAppBlock)

  writeFileSync(readmePath, updated)
  console.log('README metrics updated from docs/perf-latest.json')
}

main()
