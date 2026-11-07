# Opening-delay isolation — 4 November 2026

This follow-up uses a small database-free control to investigate the remaining opening wait. It does not repeat the full-site audit or alter campaign data. The published baseline is `dpl_CE8hQuNTcyJVrgE1C7dutA62dJBZ`.

## Established-connection control

The health endpoint is registered before the database connection middleware. Its preceding request middleware does not perform database work for health GET requests. A slow health response therefore does not require an authentication lookup, Notebook query or source-library read.

An initial public health request took 2,232 ms and reported 0.4 ms in its handler with zero database readiness time. Because that first request included a new connection, it alone could not isolate startup from connection establishment. Its following authenticated read succeeded without changing user data.

The next check used one curl process per immutable deployment. It fetched static HTML first, then two health responses, retaining the same origin connection. All requests returned HTTP 200. Curl confirmed zero new connections, DNS lookups or TCP/TLS handshakes for the health requests.

On the previously published compatible deployment, the first health response took 2,588 ms while reporting 0.5 ms application duration and zero database time. The repeated health request completed in 46 ms. The same protocol on the recently accessed current deployment did not reproduce the multi-second pause. The server runtime source is identical between those two deployments; this is an observation of different lifecycle states, not a before/after optimization comparison. No platform cold start was forced.

This narrows the reproduced wait to startup or routing before the measured application handler. A new client connection, database query and frontend rendering are not necessary for this occurrence. It does not distinguish application module loading from platform provisioning/queueing, or resolve the previously observed static-delivery delays.

## Keep the intervention small

The project already has Fluid compute enabled. Vercel documents concurrency and startup optimizations for Services under [Fluid compute](https://vercel.com/kb/guide/vercel-services-fluid-compute). Actual responses in this check were served through Frankfurt. No hosting switch, region, memory tier or billing setting was changed.

A local check parsed the roughly 18 MB monster reference/token JSON in about 47 ms. That is a local CPU observation, not a hosted attribution, and does not explain a multi-second wait by itself. It does not justify restructuring the monster library on the evidence available.

One unpublished diagnostic candidate adds a first-import timing marker and one safe startup log around module evaluation. It logs only elapsed milliseconds, with no environment values or account data. It preserves the existing application and extension dispatcher and cannot promote itself: the task helper has no promotion action. All 288 existing tests and backend types pass; frontend sources are unchanged and retain the preceding build verification. The candidate is staged without assigning public aliases.

## Diagnostic result and decision

The unpublished diagnostic is `dpl_DmUYrB5aSGdYgDRFsEXevQ5e438Y`. Its hosted manifest matches all 490 expected inputs, with only the entrypoint and new timing-marker file differing from the published baseline. Environment variable names and configured region are unchanged. There is no promotion helper or public alias assignment for this diagnostic.

The exact first observed diagnostic health request is correlated to a startup log in Frankfurt. Its marked module-evaluation interval was 762 ms, and process uptime at that log was 1,888 ms. The health response itself completed in 324 ms on an established client connection, with 0.6 ms reported by the application handler. These measures have different starting points: process uptime is not request latency, and the module interval excludes work before the marker can execute. They must not be subtracted into a complete lifecycle breakdown or added to the HTTP duration. They show that startup work can overlap platform preparation before the user-visible request wait. Moving initialization into the first request could consequently make that request slower.

Two additional startup logs were observed in San Francisco for auth requests not made by this investigation; their marked intervals were 895 and 935 ms. Their origin is not established here. They are not Frankfurt latency controls or evidence that our measured requests were routed to the wrong region. The correlated health request's runtime log explicitly identifies Frankfurt, matching its response routing identifier.

One authenticated read for an intentionally absent character returned 404, using the existing safe sheet-timing log path to check correlation. No character was saved or changed. All other investigative HTTP requests read static HTML or health. No database migration, production restore, cache architecture, warm-up schedule, paid feature or hosting setting was introduced.

The evidence establishes a substantial startup/routing delay outside database work for the reproduced control, and a measurable application-initialization interval in the diagnostic. It does not establish which small code edit would remove the intermittent user-visible delay. A full router split or new cache would be speculative, while recurring warm-up requests would add usage without addressing the cause. Those changes were not made. The diagnostic stays unpublished; live website and Owlbear aliases remain unchanged.

If further optimization is pursued, the focused experiment is reducing initial dependency loading and measuring actual user-visible readiness, while preserving useful pre-initialization. That requires a demonstrated benefit before publication. The issue remains open; this check narrows the cause rather than claiming a latency fix.

Evidence remains ignored under `.local/startup-check-20261104/`: `connection-check.json`, `diagnostic-connection.json`, `startup-measurements.json`, exact frozen source and manifest, test/type logs, `hosted-source.json`, private runtime logs and final gates. Raw credentials and account contents are not included in this report.
