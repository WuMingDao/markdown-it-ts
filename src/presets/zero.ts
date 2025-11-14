import type { MarkdownItOptions } from '../index'

const zeroPreset = {
  options: {
    html: false,
    xhtmlOut: false,
    breaks: false,
    langPrefix: 'language-',
    linkify: false,
    typographer: false,
    quotes: '\u201C\u201D\u2018\u2019',
    maxNesting: 20,
  } as MarkdownItOptions,
  components: {
    core: { rules: ['normalize', 'block', 'inline', 'text_join'] },
    block: { rules: ['paragraph'] },
    inline: { rules: ['text'] },
    inline2: { rules: ['balance_pairs', 'fragments_join'] },
  },
}

export default zeroPreset
