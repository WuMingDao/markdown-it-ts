# Performance Report (latest run)

| Size (chars) | S1 one | S2 one | S3 one | S4 one | S5 one | M1 one | S1 append | S2 append | S3 append | S4 append | S5 append | M1 append |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5000 | 0.01ms | 0.00ms | **0.00ms** | 0.37ms | 0.25ms | 0.43ms | 1.62ms | 0.48ms | **0.44ms** | 0.96ms | 0.91ms | 0.89ms |
| 20000 | 1.12ms | 1.00ms | 0.97ms | 1.20ms | 1.01ms | **0.84ms** | 3.81ms | **1.25ms** | 1.35ms | 3.96ms | 3.66ms | 2.87ms |
| 50000 | 2.78ms | 2.65ms | 2.59ms | 3.08ms | 3.09ms | **2.20ms** | 9.00ms | **3.51ms** | 3.57ms | 10.21ms | 8.91ms | 7.15ms |
| 100000 | 5.62ms | 5.78ms | 5.58ms | 6.74ms | 6.48ms | **4.94ms** | 20.25ms | 20.81ms | 21.56ms | 20.82ms | 17.95ms | **13.70ms** |
| 200000 | **12.35ms** | 14.92ms | 15.17ms | 17.10ms | 12.43ms | 13.31ms | 41.84ms | 40.55ms | 42.11ms | 46.64ms | 41.48ms | **30.53ms** |

Best (one-shot) per size:
- 5000: S3 0.00ms (stream ON, cache ON, chunk ON)
- 20000: M1 0.84ms (markdown-it (baseline))
- 50000: M1 2.20ms (markdown-it (baseline))
- 100000: M1 4.94ms (markdown-it (baseline))
- 200000: S1 12.35ms (stream ON, cache OFF, chunk ON)

Best (append workload) per size:
- 5000: S3 0.44ms (stream ON, cache ON, chunk ON)
- 20000: S2 1.25ms (stream ON, cache ON, chunk OFF)
- 50000: S2 3.51ms (stream ON, cache ON, chunk OFF)
- 100000: M1 13.70ms (markdown-it (baseline))
- 200000: M1 30.53ms (markdown-it (baseline))

Recommendations (by majority across sizes):
- One-shot: M1(3), S3(1), S1(1)
- Append-heavy: S2(2), M1(2), S3(1)

Notes: S2/S3 appendHits should equal 5 when append fast-path triggers (shared env).

## Best-of markdown-it-ts vs markdown-it (baseline)

| Size (chars) | TS best one | Baseline one | One ratio | TS best append | Baseline append | Append ratio | TS scenario (one/append) |
|---:|---:|---:|---:|---:|---:|---:|:--|
| 5000 | 0.00ms | 0.43ms | 0.00x | 0.44ms | 0.89ms | 0.50x | S3/S3 |
| 20000 | 0.97ms | 0.84ms | 1.16x | 1.25ms | 2.87ms | 0.43x | S3/S2 |
| 50000 | 2.59ms | 2.20ms | 1.18x | 3.51ms | 7.15ms | 0.49x | S3/S2 |
| 100000 | 5.58ms | 4.94ms | 1.13x | 17.95ms | 13.70ms | 1.31x | S3/S5 |
| 200000 | 12.35ms | 13.31ms | 0.93x | 40.55ms | 30.53ms | 1.33x | S1/S2 |

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