# Performance Report (latest run)

| Size (chars) | S1 one | S2 one | S3 one | S4 one | S5 one | M1 one | S1 append | S2 append | S3 append | S4 append | S5 append | M1 append |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5000 | 0.01ms | 0.00ms | **0.00ms** | 0.43ms | 0.26ms | 0.40ms | 1.81ms | **0.42ms** | 0.49ms | 0.91ms | 0.88ms | 0.82ms |
| 20000 | 1.16ms | 1.15ms | 0.96ms | 1.21ms | 0.98ms | **0.90ms** | 3.72ms | **1.17ms** | 1.28ms | 4.04ms | 3.47ms | 2.94ms |
| 50000 | 2.55ms | 2.60ms | 2.68ms | 4.80ms | 2.59ms | **2.33ms** | 8.56ms | **3.26ms** | 3.58ms | 10.18ms | 8.75ms | 7.46ms |
| 100000 | 7.46ms | 6.55ms | 6.29ms | 7.03ms | **5.93ms** | 6.55ms | 19.92ms | 22.05ms | 22.57ms | 21.86ms | 19.70ms | **15.11ms** |
| 200000 | 25.77ms | 14.20ms | 13.31ms | 18.29ms | 17.06ms | **11.62ms** | 48.01ms | 53.01ms | 50.22ms | 53.13ms | 45.70ms | **33.10ms** |

Best (one-shot) per size:
- 5000: S3 0.00ms (stream ON, cache ON, chunk ON)
- 20000: M1 0.90ms (markdown-it (baseline))
- 50000: M1 2.33ms (markdown-it (baseline))
- 100000: S5 5.93ms (stream OFF, chunk OFF)
- 200000: M1 11.62ms (markdown-it (baseline))

Best (append workload) per size:
- 5000: S2 0.42ms (stream ON, cache ON, chunk OFF)
- 20000: S2 1.17ms (stream ON, cache ON, chunk OFF)
- 50000: S2 3.26ms (stream ON, cache ON, chunk OFF)
- 100000: M1 15.11ms (markdown-it (baseline))
- 200000: M1 33.10ms (markdown-it (baseline))

Recommendations (by majority across sizes):
- One-shot: M1(3), S3(1), S5(1)
- Append-heavy: S2(3), M1(2)

Notes: S2/S3 appendHits should equal 5 when append fast-path triggers (shared env).

## Best-of markdown-it-ts vs markdown-it (baseline)

| Size (chars) | TS best one | Baseline one | One ratio | TS best append | Baseline append | Append ratio | TS scenario (one/append) |
|---:|---:|---:|---:|---:|---:|---:|:--|
| 5000 | 0.00ms | 0.40ms | 0.00x | 0.42ms | 0.82ms | 0.51x | S3/S2 |
| 20000 | 0.96ms | 0.90ms | 1.06x | 1.17ms | 2.94ms | 0.40x | S3/S2 |
| 50000 | 2.55ms | 2.33ms | 1.10x | 3.26ms | 7.46ms | 0.44x | S1/S2 |
| 100000 | 5.93ms | 6.55ms | 0.91x | 19.70ms | 15.11ms | 1.30x | S5/S5 |
| 200000 | 13.31ms | 11.62ms | 1.15x | 45.70ms | 33.10ms | 1.38x | S3/S5 |

- One ratio < 1.00 means markdown-it-ts best one-shot is faster than baseline.
- Append ratio < 1.00 highlights stream cache optimizations (fast-path appends).


### Diagnostic: Chunk Info (if chunked)

| Size (chars) | S1 one chunks | S3 one chunks | S4 one chunks | S1 append last | S3 append last | S4 append last |
|---:|---:|---:|---:|---:|---:|---:|
| 5000 | 4 | 4 | 4 | 4 | 4 | 4 |
| 20000 | 6 | 2 | 8 | 6 | 2 | 8 |
| 50000 | 6 | 6 | 8 | 6 | 6 | 8 |
| 100000 | - | - | 8 | - | - | 8 |
| 200000 | - | - | 8 | - | - | 8 |