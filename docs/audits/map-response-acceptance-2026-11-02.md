# Automated map-response acceptance: HOLD

Sir, this run does **not** establish a positive performance effect. The candidate remains held. No visual inspection is needed to interpret that decision, and no production promotion was performed.

## Test contract

The acceptance plan was written before the hosted comparison began. It requires:

- 24 alternating control/candidate pairs for a complete image download and bitmap decode.
- 12 alternating pairs of actual map openings with the browser image cache bypassed.
- 12 alternating pairs of actual map openings with image reuse available.
- One excluded warmup for each version and cohort, identical image hashes/dimensions, and complete observation counts.
- At least a 15% and 100 ms paired median gain for full-image loading, and a 10% and 100 ms paired median gain for actual uncached opening. The upper end of a reproducible 95% paired bootstrap interval must remain below zero.
- No p90 regression exceeding the larger of 100 ms or 10%, and the same budget for the cached-opening median.
- Passing hosted image-byte/header, owner/player/preview, conditional 304, revocation, stale-write and cleanup checks.
- Exact deployment source audits and an unchanged public production alias.

Any timeout, incomplete cohort, failed regression check or unmet performance threshold produces HOLD. There is no fallback to a subjective visual approval.

## Hosted scope

Two fresh, unaliased review deployments were created from the exact 423-file live source. The control is byte-identical to that source. The candidate changes only `server/middleware/large-transfer.ts`; none of the other working-tree changes were included. Both source manifests were verified against hosted files before testing and again afterwards.

- Control: `dpl_H6ySoKd5xKApQYZm9ZFZTDnWMws3`.
- Candidate: `dpl_86Y8UXTCfKFTNrA2fEwdfAshHWG7`.
- Public deployment remains `dpl_ExfrJQJhALMYa3EJyB6Wd8MupCFf`.

The browser test used a loopback relay with the same HTTP/2 upstream handling and existing authenticated session for both versions. This avoided exposing credentials or changing the real campaign. It adds a test-network hop, so a relay failure must not be presented as proof that ordinary users experience the same delay. The actual application views were to receive identical local instrumentation for DOM readiness and cache-cohort checks; those measured UI cohorts were never reached.

## What happened

1. The first harness attempt received the full control body in about 30.5 seconds but waited indefinitely on a detached `HTMLImageElement.decode()` promise. A completed 1×1 GIF showed the same behavior in this test browser. That attempt collected no measured pairs and was excluded as a harness problem. The decoder was changed to `createImageBitmap()` with its own deadline; the small-image control succeeded.
2. The next attempt hit the 35-second request deadline during the control's full-image warmup. It collected **zero measured pairs**. This attempt is a failed acceptance run, not a favorable performance observation. No median improvement, p90 comparison or confidence interval is computed from it.
3. The independent hosted regression run logged into the existing synthetic accounts, checked their empty state, created a temporary character/assignment, and then timed out during the large synthetic image upload. It did not complete the image/access matrix, so it does not count as a hosted regression pass.
4. Its `finally` cleanup completed: the synthetic character, assignment and newly added membership were removed; the test room's map list and storage quotas returned to their initial values. The real campaign and map were not written.
5. Postflight audits confirmed both review source trees and the unchanged public alias. The browser tab and loopback relay were closed, with no remaining listeners on ports 4315–4317.

The evidence cannot distinguish an application transport problem from connection/relay/platform behavior in this run. It does not establish that the candidate is slower, unsafe, or ineffective. It also does not establish the improvement required to approve it. Earlier local correctness passes and fast production reads cannot substitute for the missing comparison.

## Reusable automated decision

The classifier is [map-delivery-acceptance.mjs](../../scripts/benchmarks/map-delivery-acceptance.mjs). It returns exit code **0 for PASS** and **2 for HOLD**, writes a JSON decision, and never deploys anything. Missing or invalid input is HOLD. Nine regression tests verify meaningful-gain, slowdown, negligible-gain, incomplete-pair, missing-warmup, altered-image, access/cleanup/source/page-error, warm-tail and cache-cohort cases.

Run it on the retained evidence:

```powershell
node scripts/benchmarks/map-delivery-acceptance.mjs `
  --plan .local/map-acceptance-20261102/plan.json `
  --browser .local/map-acceptance-20261102/attempt2.json `
  --security .local/map-acceptance-20261102/security.json `
  --audit .local/map-acceptance-20261102/deployment-audit.json `
  --postflight .local/map-acceptance-20261102/postflight.json `
  --golden .local/map-acceptance-20261102/golden.json `
  --out .local/map-acceptance-20261102/result.json
```

Expected decision: **HOLD**, `positiveEffectEstablished:false`, `requiresManualInspection:false`, `productionPromotion:false`.

`requiresManualInspection:false` means that this run's go/no-go decision is automated. It does not mean that the performance benefit has been proved, that further automated testing is unnecessary, or that every future network/device is covered.

The underlying plan, frozen source/manifests, deployment audits, failed attempts, hosted security/cleanup state, golden image identity, classifier tests and result are retained under `.local/map-acceptance-20261102/`. No credentials or original map bytes were written into the new checked-in scripts or this report.
