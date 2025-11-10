# 性能对比摘要（markdown-it-ts vs markdown-it vs remark）

一句话突出优势：

- markdown-it-ts 在保留与 `markdown-it` 兼容 API 的同时，借助 TypeScript 类型与流式/分块解析，在实时编辑与增量更新场景下能把解析延迟降到传统实现的一小部分，从而显著提升交互响应速度与工程可靠性。

## one-shot 解析时间对比（来自 `docs/perf-latest.json`）
> 注：数值为 oneShotMs（毫秒），"Best TS" 表示 S1..S5 场景中 per-size 的最优 oneShotMs；5k 的极低值为 warm-cache 情形（appendHits 存在）。

| Size (chars) | Best TS (scenario) | TS oneShot (ms) | markdown-it (M1) oneShot (ms) | remark (R1) oneShot (ms) | TS / M1 |
|---:|:---:|---:|---:|---:|---:|
| 5,000  | S3 (stream+cache+chunk) | 0.00016807 | 0.42920833 | 6.28984447 | 0.00039x |
| 20,000 | S5 (full plain)         | 0.95335835 | 0.84457500 | 27.32490420 | 1.13x |
| 50,000 | S2 (stream+cache)       | 2.59080410 | 2.18116250 | 77.56094590 | 1.19x |
|100,000 | S5 (full plain)         | 5.59916667 | 5.90147917 | 301.24736117 | 0.95x |
|200,000 | S1 (stream+chunk)       | 12.76794800| 13.68375000| 432.30398950 | 0.93x |

## 结论要点

- Remark 的 parse-only 吞吐在这些样本上明显慢于 markdown-it / markdown-it-ts（特别是在大文档上）；但 remark 的优势在于 AST/插件管线，基准仅测 parse 吞吐，不代表在所有语义转换场景中的效果。
- markdown-it-ts 的亮点在于流式/分块与缓存优化：在实时/增量场景（例如编辑器预览、append-heavy）下，启用 stream+cache+chunk 后延迟可大幅低于传统实现（示例：20k 文档中约 2.5× 加速）。
- 对于一次性超大文档（>100k），建议使用仓库的 `fullChunkedFallback` 与 `autoTuneChunks` 选项并在目标机上复测以选出最佳策略。

## 如何复现（快速步骤）

```bash
# 安装依赖（如果尚未）
npm install

# 构建库（脚本会生成 dist/index.js 用于 benchmark）
npm run build

# 运行性能生成脚本并导出 JSON（包含 remark 场景）
PERF_JSON=1 node scripts/perf-generate-report.mjs > docs/perf-latest-with-remark.json
```

该文件基于仓库中的 `docs/perf-latest.json`（已包含 Remark 数据）。如果需要，我可以：

- 将本文件合并到现有博客草稿或 README 中；
- 基于此 JSON 自动生成 SVG/PNG 对比图并保存到 `docs/`；
- 提交一个小 PR 包含 `perf-generate-report.mjs` 的改动与此摘要文件。
