# Backend startup candidate review — 4 November 2026

No production optimization was published. A small deferred monster-data candidate reduces application initialization in the measurements below, but the hosted comparison does not establish a shorter opening wait. The most practical next user-facing experiment is to start the **existing** sign-in request earlier and hand its response to the auth store once. For reducing backend startup itself, the next requirement is platform lifecycle attribution for the correlated slow request, rather than another speculative router rewrite.

## Verified baseline and scope

Read the remaining checks, startup isolation, startup options and sign-in page preparation records before gathering new measurements. The completed page preparation and accepted DMV limitation were left alone. No browser or Owlbear room was opened or controlled.

Both website aliases still resolve to `dpl_Kos3t4SFmhPRmNNfVAFFPcXVyBTh`, immutable address `https://dndoldal-6l4jo0l9k-dndenjoyerstudio.vercel.app`. All 491 hosted source inputs exactly match the preceding frozen release and its local archived source. The project API confirms Fluid Compute enabled; deployment regions remain `fra1`. Earlier correlated execution evidence and the new measured requests identify Frankfurt. Both Owlbear aliases remain on `dpl_6yPZh1hytcg8a2XNzSHnRpZjpz8W`.

The substantial dirty root checkout was not used as a deployment source. New experiments copy and hash-check the exact archived production manifest, then allow only their explicit changes. Final preservation checks cover 837 existing tracked/unignored files, with only this audit and its index update allowed. No root product runtime file was changed. There were no campaign writes, schema/index changes, paid upgrades, region changes, warm-up schedule or artificial keep-alive traffic.

## What can actually be separated

The retained established-connection control remains the strongest database-free evidence: one first health response took 2,588 ms, with 0.5 ms in the application and zero database readiness time; its next response took 46 ms. That occurrence needs neither database queries nor a new client TCP/TLS connection. It does not attribute the delay completely to hosting provisioning.

New read-only sign-in observations use static HTML to establish one curl origin connection before API requests. Every API transfer reports zero new connections and zero client DNS/TCP/TLS setup. These are **two separate deployment/lifecycle observations**, not forced or matched platform cold starts, percentiles, or everyday performance estimates:

| Measured stage | Production-source control | Deferred-data candidate |
| --- | ---: | ---: |
| First sign-in HTTP completion | 607 ms | 2,214 ms |
| Application handler interval (`app`) | 230.7 ms | 200.5 ms |
| Connection readiness inside that handler (`db`) | 211.6 ms | 179.6 ms |
| Other timed handler work, including the account lookup | about 19.1 ms | about 20.9 ms |
| Marked module-evaluation interval, correlated to this request | 774 ms | 623 ms |
| Process uptime when the startup log was emitted | 1,942 ms | 1,159 ms |

The `db` interval is contained within `app`; it is connection readiness, not a measurement of every database command. The remaining handler work includes the actual account read. The HTTP time outside `app` includes routing/transport and response overhead as well as any initialization/queueing that falls on that request's path. It is not a direct measure of platform provisioning. The module marker excludes work before its first import can execute. Process uptime, module time and HTTP latency have different starting points and overlapping work; do not add them or subtract them into a complete startup waterfall. In particular, the control's module interval exceeds its measured HTTP duration, illustrating useful pre-initialization/overlap.

The subsequent database-free health responses took 394 ms for control and 762 ms for candidate, each reporting only 0.2 ms of handler work and zero database readiness. A subsequent request does not prove instance continuity or a warm lifecycle. These observations retain substantial unexplained time outside measured application work.

Available runtime records contain request/trace identifiers, region and the safe application startup log. Their attributes are empty and they expose no provisioning, queue or lifecycle duration fields. Startup logs from San Francisco belong to other requests whose origin is unestablished; they are excluded from the Frankfurt comparison. No new region-misconfiguration claim follows from them.

## Candidate and local investigation

The frozen backend eagerly imports the monster reference and token snapshots, totaling 17,788,516 bytes, through ordinary application imports. The native image encoder is already deferred; changing it again offers no startup work removal. Mongoose/driver, Express and validation code contribute to fresh-process initialization, but sign-in needs that shared foundation. Loading Mongoose is application initialization, not a database connection.

A first local tsx CPU profile was dominated by filesystem and runtime transformation work. A separate bundled fresh-process profile removes the tsx transformation and still identifies substantial shared-package loading. Neither local setup is the Vercel runtime artifact or a hosted attribution. Inclusive dependency-load durations overlap and are not summed.

The isolated candidate changes only `server/lib/monster-enrichment.ts` and its private `monsterSnapshotId` caller in `server/routes/monster-workshop.ts`:

- Read the unchanged reference/token JSON on the first operation that needs each file; cache successful reads per process.
- Keep ordinary, non-monster rule responses free of those reads.
- Resolve the snapshot revision on demand, without introducing a duplicate hard-coded revision.
- Preserve matching, source/edition safeguards, token precedence and saved enrichment behavior. File-read failures remain retryable rather than caching failed initialization.

Five alternating serial fresh local process pairs used ESM bundles and the same installed external dependencies, without a database. Health readiness medians were 1,077 ms for control and 818 ms for candidate. Completion through the first standard-monster enrichment had medians of 1,078 ms and 874 ms respectively. The candidate's first monster operation itself incurred 49–66 ms; repeats rounded to 0–1 ms. These controlled **local build** results justified a hosted experiment, not publication. An initial per-file CommonJS harness could not preserve the application ESM cycle and was discarded; none of its failed runs count as performance evidence.

All 303 candidate tests pass, with the same two optional external-pack tests skipped. Six new tests cover no eager file reads, non-monster access, cached revision/data, saved tokens, empty reads and retry after read failure. Backend types pass after an explicit return-type correction; the prior failure and logs are retained. Frontend inputs are byte-identical to the already verified production build. Independent baseline/candidate processes produce the exact same complete output fingerprint for all 334 standard monsters plus four native/unknown-source/alias cases.

## Hosted experiment and decision

Two diagnostic deployments were staged using the established source-manifest upload, production environment and **no public alias assignment**:

- Control: `dpl_CnQ5FcPEb4jjh8gmG9SxGZ8AdPt8`, `https://dndoldal-pv83jis21-dndenjoyerstudio.vercel.app`; all 492 expected inputs match.
- Candidate: `dpl_BaaKktNg7T3aBtpaY6YkMEyL4jsa`, `https://dndoldal-r8uv9j8xa-dndenjoyerstudio.vercel.app`; all 493 expected inputs match.

Both add the same first-import marker and one safe module-duration log. The candidate additionally contains the two runtime edits and the regression test. Regions and environment-variable names match the baseline. The diagnostic helper has no promotion action.

The experiment follows the preview-and-measure-before-shipping approach in [Vercel's slow-function debugging guide](https://vercel.com/docs/functions/debug-slow-functions). Its generic first-versus-repeat advice is not treated as proof that a particular invocation was cold.

Each deployment received one finite sequence: static HTML, first authenticated sign-in, health, first/repeated standard-monster read, repeated sign-in. All returned 200. Every compared API response matches exactly. The candidate's first standard-monster response actually loads and supplements the hosted frozen data, verifying file inclusion/resolution rather than only local behavior. The endpoint also reads the external SRD service: its first-request duration cannot isolate JSON loading from upstream latency. No game content was submitted or changed.

The marked Frankfurt module interval is 151 ms shorter in the candidate, but its observed first sign-in HTTP response is slower overall. These different lifecycle states do not establish a causal regression either. They establish **no demonstrated hosted readiness benefit** from this experiment. Defer publication: the change also moves synchronous work into the first monster operation, and removing already-overlapped initialization need not reduce the visitor's wait. No additional deployments or repeated warm probes were used to hunt for a favorable result.

## Options and next concrete step

| Option | Evidence and tradeoff | Decision |
| --- | --- | --- |
| Defer this monster-data group | Local readiness improved and the marked hosted module interval shortened; hosted opening benefit remains unproven, with work shifted to the first monster read | Retain isolated candidate, unpublished |
| Defer the entire ordinary router or database library | Sign-in still needs shared dependencies; the host already overlaps some initialization | No broad split or speculative rewrite |
| Start the original sign-in request from initial HTML | Can overlap host waiting with entry-code download/evaluation; bounded by the current frontend-before-auth gap, not by the full cold wait | Most practical next code experiment for usable opening time |
| Change connection pooling/database tier | New first sign-in connection readiness was about 180–212 ms; prior slow health needed no database work | No established remedy for the multi-second outside-handler wait |
| Fluid/region changes, paid upgrades, keep-alives | Existing enabled settings are verified; no measured alternative or lifecycle guarantee supports a change | Do not change |

For the earlier sign-in experiment, reuse the original `/api/auth/me` response exactly once in `src/stores/auth.ts`; do not introduce a second probe. Limit initiation to the intended startup flow, preserve expiry/logout/login races, failure/timeout recovery and requested-destination handling, and retain the completed public-page preparation. Require one physical sign-in request, private reads only after verification, and matched built/hosted usable-page measurements before publication. This overlaps the wait rather than shortening platform startup, and cannot help before HTML is delivered. The retained 190 ms frontend-before-auth observation is a prior trace, not a new estimate or promised saving.

For strict backend startup attribution, use the captured requests below in Vercel Observability or a support investigation and ask for provisioning, initialization, pre-initialization and routing/queue intervals on a common request timeline. The client/handler measurements alone cannot recover those stages. Do not add paid observability or change infrastructure without discussing it. A support request was not sent.

- Slow candidate sign-in: `p9k8r-1793803512340-a09cb95f6e70`, Frankfurt, 2026-11-04 around 14:45:12 UTC; deployment `dpl_BaaKktNg7T3aBtpaY6YkMEyL4jsa`.
- Control sign-in: `94cjz-1793803517148-6bdda16d5f35`, Frankfurt, around 14:45:17 UTC; deployment `dpl_CnQ5FcPEb4jjh8gmG9SxGZ8AdPt8`.
- Subsequent candidate database-free health: `mmdm8-1793803514567-482c9ee7dcb1`, Frankfurt, around 14:45:14 UTC.

If the deferred-data candidate is reconsidered, compare end-to-end sign-in and first content readiness on naturally starting instances using those immutable sources and the same instrumentation. Record lifecycle evidence and variance; do not call a newly deployed or merely first-observed request a guaranteed cold start. The present evidence is sufficient to withhold this release without more probes.

Ignored evidence is under `.local/backend-startup-review-20261104/`: verified production baseline, exact frozen candidate/control sources and manifests, local profiles/comparison/parity, test/type logs, diagnostic deployment/source checks, finite HTTP observations, correlated startup logs and final gates. Private HTTP bodies, request headers and raw logs remain ignored. Credentials are never included in this report.
