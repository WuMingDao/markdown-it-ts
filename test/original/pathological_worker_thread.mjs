import { parentPort } from 'node:worker_threads'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!parentPort) {
  throw new Error('This script must be run as a worker thread')
}

parentPort.on('message', async (str) => {
  try {
    // Resolve upstream markdown-it module location
    const specifier = process.env.MARKDOWN_IT_DIR
      ? pathToFileURL(resolve(process.env.MARKDOWN_IT_DIR, 'index.mjs')).href
      : new URL('../../../markdown-it/index.mjs', import.meta.url).href
    const { default: markdownit } = await import(specifier)
    const md = markdownit()
    const res = md.render(str)
    parentPort.postMessage({ ok: true, res })
  } catch (err) {
    parentPort.postMessage({ ok: false, err: err instanceof Error ? err.message : String(err) })
  }
})
