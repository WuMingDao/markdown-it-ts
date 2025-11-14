import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import generate from 'markdown-it-testgen'

describe('markdown-it', function () {
  let md

  beforeAll(async () => {
    const specifier = process.env.MARKDOWN_IT_DIR
      ? pathToFileURL(resolve(process.env.MARKDOWN_IT_DIR, 'index.mjs')).href
      : new URL('../../../markdown-it/index.mjs', import.meta.url).href
    const { default: markdownit } = await import(specifier)
    md = markdownit({
      html: true,
      langPrefix: '',
      typographer: true,
      linkify: true
    })
  })

  // Use fixtures from sibling markdown-it repo to avoid duplicating large files
  generate(fileURLToPath(new URL('../../../markdown-it/test/fixtures/markdown-it', import.meta.url)), md)
})
