# Map delivery acceptance gate

`map-delivery-acceptance.mjs` evaluates a frozen, paired hosted experiment. It does not run a benchmark, create fixtures or deploy a candidate. A result is useful only when its input comes from the documented automated harness and source audits.

Provide JSON inputs using `--plan`, `--browser`, `--security`, `--audit`, `--postflight`, `--golden`, and `--out`. The frozen policy requires 24 full-image pairs, 12 cold UI pairs, 12 warm UI pairs, balanced order and six completed warmups. It verifies byte/hash/dimension/cache cohorts, hosted access and cleanup results, source identity and an unchanged production alias before applying the declared performance thresholds.

Exit code 0 means PASS. Exit code 2 means HOLD, including missing evidence, timeouts, incomplete samples, regressions or an improvement too small/uncertain to meet the threshold. The script never promotes a deployment. Its finite-sample result is not a guarantee about every future device or connection.

Test the classifier:

```powershell
npm.cmd test -- scripts/benchmarks/map-delivery-acceptance.test.ts
```

The first hosted run and exact replay command are documented in [the acceptance report](../../docs/audits/map-response-acceptance-2026-11-02.md). That run is HOLD because the hosted comparison and regression matrix did not complete. No performance saving is inferred from missing data.
