import type { Token } from '../common/token'
import type { MarkdownIt } from '../index'
import type { ParserCore } from '../parse/parser_core'
import { countLines } from '../common/utils'
import { chunkedParse } from './chunked'

interface StreamCache {
  src: string
  tokens: Token[]
  env: Record<string, unknown>
  // Cache line count to avoid recounting
  lineCount?: number
}

const EMPTY_TOKENS: Token[] = []

export interface StreamStats {
  total: number
  cacheHits: number
  appendHits: number
  fullParses: number
  resets: number
  chunkedParses?: number
  lastMode: 'idle' | 'cache' | 'append' | 'full' | 'reset' | 'chunked'
}

function makeEmptyStats(): StreamStats {
  return {
    total: 0,
    cacheHits: 0,
    appendHits: 0,
    fullParses: 0,
    resets: 0,
    chunkedParses: 0,
    lastMode: 'idle',
  }
}

export class StreamParser {
  private readonly core: ParserCore
  private cache: StreamCache | null = null
  private stats: StreamStats = makeEmptyStats()

  // Only use stream optimization for documents larger than this threshold
  private readonly MIN_SIZE_FOR_OPTIMIZATION = 1000 // characters

  // (reserved for future adaptive strategy metrics)

  constructor(core: ParserCore) {
    this.core = core
  }

  reset(): void {
    this.cache = null
    this.stats.resets += 1
    this.stats.lastMode = 'reset'
  }

  resetStats(): void {
    const { resets } = this.stats
    this.stats = makeEmptyStats()
    this.stats.resets = resets
  }

  parse(src: string, env: Record<string, unknown> | undefined, md: MarkdownIt): Token[] {
    const envProvided = env
    const cached = this.cache

    // Only update the cache on the very first parse or when the current
    // source ends at a safe block boundary (double newline). This prevents
    if (!cached || (envProvided && envProvided !== cached.env)) {
      const workingEnv = envProvided ?? {}

      // Allow chunked for first parse when enabled and large enough
      const chunkedEnabled = !!md.options?.streamChunkedFallback
      const chunkAdaptive = md.options?.streamChunkAdaptive !== false
      const targetChunks = md.options?.streamChunkTargetChunks ?? 8
      const chunkSizeCharsCfg = md.options?.streamChunkSizeChars
      const chunkSizeLinesCfg = md.options?.streamChunkSizeLines
      const auto = md.options?.autoTuneChunks !== false
      const chunkFenceAware = md.options?.streamChunkFenceAware ?? true

      const srcLineCount = countLines(src)
      const isVeryLargeOneShot = (src.length >= (md.options?.fullChunkThresholdChars ?? 20_000) * 2.5) || (srcLineCount >= (md.options?.fullChunkThresholdLines ?? 400) * 2.5)

      // Heuristic: very large one-shot payloads are likely history restore/display.
      // In such cases, treat as non-stream for performance and memory: do not cache.
      if (isVeryLargeOneShot) {
        const state = this.core.parse(src, workingEnv, md)
        const tokens = state.tokens
        // Intentionally skip caching to avoid holding a massive token array in memory
        this.stats.total += 1
        this.stats.fullParses += 1
        this.stats.lastMode = 'full'
        return tokens
      }
      else if (chunkedEnabled) {
        const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : (v > hi ? hi : v)
        // Best-practice discrete mapping (append-focused) when user didn't force sizes
        let useChars = chunkAdaptive ? clamp(Math.ceil(src.length / targetChunks), 8000, 32000) : (chunkSizeCharsCfg ?? 10000)
        let useLines = chunkAdaptive ? clamp(Math.ceil(srcLineCount / targetChunks), 150, 350) : (chunkSizeLinesCfg ?? 200)
        if (auto && !chunkSizeCharsCfg && !chunkSizeLinesCfg) {
          if (src.length <= 5_000) {
            useChars = 16_000
            useLines = 250
          }
          else if (src.length <= 20_000) {
            useChars = 16_000
            useLines = 200
          }
          else if (src.length <= 50_000) {
            useChars = 16_000
            useLines = 250
          }
          else if (src.length <= 100_000) {
            useChars = 10_000
            useLines = 200
          }
          else {
            useChars = 20_000
            useLines = 200
          }
        }
        // Avoid chunked fallback for character-by-character growth (no trailing newline)
        const hasTrailingNewline = src.length > 0 && src.charCodeAt(src.length - 1) === 0x0A
        if ((src.length >= (useChars * 2) || srcLineCount >= (useLines * 2)) && hasTrailingNewline) {
          const tokens = chunkedParse(md, src, workingEnv, {
            maxChunkChars: useChars,
            maxChunkLines: useLines,
            fenceAware: chunkFenceAware,
          })
          this.cache = { src, tokens, env: workingEnv, lineCount: srcLineCount }
          this.stats.total += 1
          this.stats.chunkedParses = (this.stats.chunkedParses || 0) + 1
          this.stats.lastMode = 'chunked'
          return tokens
        }
      }

      const state = this.core.parse(src, workingEnv, md)
      const tokens = state.tokens
      const lineCount = countLines(src)

      this.cache = { src, tokens, env: workingEnv, lineCount }
      this.stats.total += 1
      this.stats.fullParses += 1
      this.stats.lastMode = 'full'
      return tokens
    }

    if (src === cached.src) {
      this.stats.total += 1
      this.stats.cacheHits += 1
      this.stats.lastMode = 'cache'
      return cached.tokens
    }

    // For small documents growing from scratch, optimization overhead is not worth it
    // But if we already have a cache, always try to optimize (user is editing)
    const threshold = md.options?.streamOptimizationMinSize ?? this.MIN_SIZE_FOR_OPTIMIZATION
    const isGrowingFromSmall = cached.src.length < threshold && src.length < threshold * 1.5

    if (isGrowingFromSmall && !src.startsWith(cached.src)) {
      // Small document with non-append edit - just reparse
      const fallbackEnv = envProvided ?? cached.env
      const fullState = this.core.parse(src, fallbackEnv, md)
      const nextTokens = fullState.tokens
      const lineCount = countLines(src)
      this.cache = { src, tokens: nextTokens, env: fallbackEnv, lineCount }
      this.stats.total += 1
      this.stats.fullParses += 1
      this.stats.lastMode = 'full'
      return nextTokens
    }

    const appended = this.getAppendedSegment(cached.src, src)
    if (appended) {
      // Fast-path: reuse existing tokens when new input is a clean append that starts on a fresh line.
      // This is conservative; edits requiring cross-block context still fall back to a full parse below.
      // Special-case: a single trailing newline closes the last line but doesn't
      // produce new tokens; we only need to extend end line maps for trailing blocks.
      // no special-casing for single newline here; we only append when we have
      // full line(s) content that end with a newline.

      const appendedState = this.core.parse(appended, cached.env, md)

      // Use cached line count if available
      const lineOffset = cached.lineCount ?? countLines(cached.src)

      if (lineOffset > 0)
        this.shiftTokenLines(appendedState.tokens, lineOffset)

      // Avoid array spread - directly mutate cache tokens
      cached.tokens.push(...appendedState.tokens)

      // Update cache with new src and line count
      cached.src = src
      cached.lineCount = lineOffset + countLines(appended)

      this.stats.total += 1
      this.stats.appendHits += 1
      this.stats.lastMode = 'append'
      return cached.tokens
    }

    const fallbackEnv = envProvided ?? cached.env

    // Optional: use chunked parse as a fallback for very large documents
    const chunkedEnabled = !!md.options?.streamChunkedFallback
    const chunkAdaptive = md.options?.streamChunkAdaptive !== false
    const targetChunks = md.options?.streamChunkTargetChunks ?? 8
    const chunkSizeCharsCfg = md.options?.streamChunkSizeChars
    const chunkSizeLinesCfg = md.options?.streamChunkSizeLines
    const auto = md.options?.autoTuneChunks !== false
    const chunkFenceAware = md.options?.streamChunkFenceAware ?? true

    const srcLineCount2 = countLines(src)
    if (chunkedEnabled) {
      const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : (v > hi ? hi : v)
      let useChars = chunkAdaptive ? clamp(Math.ceil(src.length / targetChunks), 8000, 32000) : (chunkSizeCharsCfg ?? 10000)
      let useLines = chunkAdaptive ? clamp(Math.ceil(srcLineCount2 / targetChunks), 150, 350) : (chunkSizeLinesCfg ?? 200)
      if (auto && !chunkSizeCharsCfg && !chunkSizeLinesCfg) {
        if (src.length <= 5_000) {
          useChars = 16_000
          useLines = 250
        }
        else if (src.length <= 20_000) {
          useChars = 16_000
          useLines = 200
        }
        else if (src.length <= 50_000) {
          useChars = 16_000
          useLines = 250
        }
        else if (src.length <= 100_000) {
          useChars = 10_000
          useLines = 200
        }
        else {
          useChars = 20_000
          useLines = 200
        }
      }
      const hasTrailingNewline2 = src.length > 0 && src.charCodeAt(src.length - 1) === 0x0A
      if ((src.length >= (useChars * 2) || srcLineCount2 >= (useLines * 2)) && hasTrailingNewline2) {
        const tokens = chunkedParse(md, src, fallbackEnv, {
          maxChunkChars: useChars,
          maxChunkLines: useLines,
          fenceAware: chunkFenceAware,
        })
        this.cache = { src, tokens, env: fallbackEnv, lineCount: srcLineCount2 }
        this.stats.total += 1
        this.stats.chunkedParses = (this.stats.chunkedParses || 0) + 1
        this.stats.lastMode = 'chunked'
        return tokens
      }
    }

    const fullState = this.core.parse(src, fallbackEnv, md)
    const nextTokens = fullState.tokens
    const lineCount = countLines(src)
    this.cache = { src, tokens: nextTokens, env: fallbackEnv, lineCount }
    this.stats.total += 1
    this.stats.fullParses += 1
    this.stats.lastMode = 'full'
    return nextTokens
  }

  private getAppendedSegment(prev: string, next: string): string | null {
    if (!next.startsWith(prev))
      return null

    if (!prev.endsWith('\n'))
      return null

    const segment = next.slice(prev.length)
    if (!segment)
      return null

    if (!segment.includes('\n'))
      return null

    if (!segment.endsWith('\n'))
      return null

    let newlineCount = 0
    for (let i = 0; i < segment.length; i++) {
      if (segment.charCodeAt(i) === 0x0A)
        newlineCount++
    }
    if (newlineCount < 2)
      return null

    // Prevent setext heading underlines from using the fast-path since they
    // retroactively change the previous line's block type.
    const firstLineBreak = segment.indexOf('\n')
    const firstLine = firstLineBreak === -1 ? segment : segment.slice(0, firstLineBreak)
    const trimmedFirstLine = firstLine.trim()

    if (trimmedFirstLine.length === 0)
      return null

    if (/^[-=]+$/.test(trimmedFirstLine)) {
      const prevWithoutTrailingNewline = prev.slice(0, -1)
      const lastBreak = prevWithoutTrailingNewline.lastIndexOf('\n')
      const previousLine = prevWithoutTrailingNewline.slice(lastBreak + 1)
      if (previousLine.trim().length > 0)
        return null
    }

    // Heuristic safety: if previous content ends inside an open fenced code block,
    // avoid append fast-path since closing fence in appended segment would
    // retroactively change prior tokens.
    if (this.endsInsideOpenFence(prev))
      return null

    return segment
  }

  // Detect if the given text ends while still inside an open fenced code block.
  // Scans backwards in a bounded window for performance.
  private endsInsideOpenFence(text: string): boolean {
    const WINDOW = 4000
    const start = text.length > WINDOW ? text.length - WINDOW : 0
    const chunk = text.slice(start)
    const lines = chunk.split('\n')
    let inFence: { marker: '`' | '~', length: number } | null = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // skip leading spaces/tabs
      let p = 0
      while (p < line.length) {
        const c = line.charCodeAt(p)
        if (c === 0x20 /* space */ || c === 0x09 /* tab */)
          p++
        else
          break
      }
      const ch = line[p]
      if (ch === '`' || ch === '~') {
        let q = p
        while (q < line.length && line[q] === ch) q++
        const runLen = q - p
        if (runLen >= 3) {
          if (!inFence)
            inFence = { marker: ch as '`' | '~', length: runLen }
          else if (inFence.marker === ch && runLen >= inFence.length)
            inFence = null
        }
      }
    }
    return inFence !== null
  }

  public peek(): Token[] {
    return this.cache?.tokens ?? EMPTY_TOKENS
  }

  public getStats(): StreamStats {
    return { ...this.stats }
  }

  // countLines moved to common utils for reuse

  private shiftTokenLines(tokens: Token[], offset: number): void {
    if (offset === 0)
      return

    // Use iterative approach with a stack to avoid recursion overhead
    const stack: Token[] = [...tokens]

    while (stack.length > 0) {
      const token = stack.pop()!

      if (token.map) {
        token.map[0] += offset
        token.map[1] += offset
      }

      if (token.children) {
        // Add children to stack for processing
        for (let i = token.children.length - 1; i >= 0; i--) {
          stack.push(token.children[i])
        }
      }
    }
  }

  // (no-op placeholder: extendEndingLine removed as unused)
}

export default StreamParser
