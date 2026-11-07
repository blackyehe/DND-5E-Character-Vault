# jq -Rs -f scripts/request-timing-summary.jq server.log
# Nearest-rank percentiles over valid JSON request_timing lines only.
def percentile(p): sort | .[(((length * p) | ceil) - 1)];
split("\n")
| map(fromjson? | select(type == "object" and .event == "request_timing" and .complete == true))
| group_by(.endpoint)
| map({
    endpoint: .[0].endpoint,
    requests: length,
    handlerP50Ms: (map(.handlerMs) | percentile(0.50)),
    handlerP95Ms: (map(.handlerMs) | percentile(0.95)),
    handlerMaxMs: (map(.handlerMs) | max),
    dbP50Ms: (map(.dbMs) | percentile(0.50)),
    dbP95Ms: (map(.dbMs) | percentile(0.95)),
    dbMaxMs: (map(.dbMs) | max)
  })
