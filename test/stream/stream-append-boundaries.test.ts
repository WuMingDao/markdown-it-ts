import { describe, it, expect } from 'vitest'
import MarkdownIt from '../../src'

describe('stream append boundaries', () => {
  it('appending paragraph with blank line boundary uses append path', () => {
    const md = MarkdownIt({ stream: true })
    md.stream.resetStats()

    let doc = 'Hello\n\n'
    let tokens = md.stream.parse(doc)

    // append safe block (paragraph + blank line)
    doc += 'World\n\n'
    tokens = md.stream.parse(doc)

    const baseline = MarkdownIt().parse(doc)
    expect(md.renderer.render(tokens, md.options, {}))
      .toEqual(MarkdownIt().renderer.render(baseline, md.options, {}))

    const stats = md.stream.stats()
    expect(stats.appendHits).toBeGreaterThanOrEqual(1)
    expect(stats.lastMode).toBe('append')
  })

  it('appending setext underline triggers full parse (no append fast path)', () => {
    const md = MarkdownIt({ stream: true })
    md.stream.resetStats()

    let doc = 'Title\n'
    md.stream.parse(doc)

    // setext underline + blank line => first line is only '=' chars
    doc += '====\n\n'
    const tokens = md.stream.parse(doc)

    const baseline = MarkdownIt().parse(doc)
    expect(md.renderer.render(tokens, md.options, {}))
      .toEqual(MarkdownIt().renderer.render(baseline, md.options, {}))

    const stats = md.stream.stats()
    expect(stats.lastMode).not.toBe('append')
  })

  it('single trailing newline does not use append fast path', () => {
    const md = MarkdownIt({ stream: true })
    md.stream.resetStats()

    let doc = 'Hello\n\nWorld'
    md.stream.parse(doc)

    doc += '\n'
    const tokens = md.stream.parse(doc)

    const baseline = MarkdownIt().parse(doc)
    expect(md.renderer.render(tokens, md.options, {}))
      .toEqual(MarkdownIt().renderer.render(baseline, md.options, {}))

    const stats = md.stream.stats()
    expect(stats.lastMode).not.toBe('append')
  })
})

