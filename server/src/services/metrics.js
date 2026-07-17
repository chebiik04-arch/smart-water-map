const counters = new Map();
const histograms = new Map();
const latencyBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export const metrics = {
  increment(name, labels = {}, value = 1) {
    const key = metricKey(name, labels);
    counters.set(key, { name, labels, value: (counters.get(key)?.value || 0) + value });
  },

  observeHttpLatency(labels, seconds) {
    const name = "http_request_duration_seconds";
    const baseKey = metricKey(name, labels);
    const current = histograms.get(baseKey) || { name, labels, count: 0, sum: 0, buckets: new Map(latencyBuckets.map((bucket) => [bucket, 0])) };
    current.count += 1;
    current.sum += seconds;
    for (const bucket of latencyBuckets) {
      if (seconds <= bucket) current.buckets.set(bucket, current.buckets.get(bucket) + 1);
    }
    histograms.set(baseKey, current);
  },

  text() {
    const lines = [
      "# HELP http_requests_total Total HTTP requests by method, route, and status class.",
      "# TYPE http_requests_total counter",
      ...counterLines("http_requests_total"),
      "# HELP http_request_duration_seconds HTTP request latency in seconds.",
      "# TYPE http_request_duration_seconds histogram",
      ...histogramLines(),
      "# HELP auth_failures_total Authentication failures by reason.",
      "# TYPE auth_failures_total counter",
      ...counterLines("auth_failures_total"),
      "# HELP rate_limit_hits_total Rate limit denials by limiter.",
      "# TYPE rate_limit_hits_total counter",
      ...counterLines("rate_limit_hits_total"),
      "# HELP device_ingestion_total Device ingestion attempts by outcome.",
      "# TYPE device_ingestion_total counter",
      ...counterLines("device_ingestion_total"),
      "# HELP operational_alerts_total Operational alerts emitted by type.",
      "# TYPE operational_alerts_total counter",
      ...counterLines("operational_alerts_total")
    ];
    return `${lines.filter(Boolean).join("\n")}\n`;
  }
};

export function routeLabel(req) {
  if (req.route?.path) {
    const mount = req.baseUrl || "";
    const path = Array.isArray(req.route.path) ? req.route.path.join("|") : req.route.path;
    return `${mount}${path}` || req.path;
  }
  return req.baseUrl || req.path || "unknown";
}

function counterLines(name) {
  return Array.from(counters.values())
    .filter((item) => item.name === name)
    .map((item) => `${name}${formatLabels(item.labels)} ${item.value}`);
}

function histogramLines() {
  const lines = [];
  for (const item of histograms.values()) {
    let cumulative = 0;
    for (const [bucket, count] of item.buckets.entries()) {
      cumulative = count;
      lines.push(`${item.name}_bucket${formatLabels({ ...item.labels, le: bucket })} ${cumulative}`);
    }
    lines.push(`${item.name}_bucket${formatLabels({ ...item.labels, le: "+Inf" })} ${item.count}`);
    lines.push(`${item.name}_sum${formatLabels(item.labels)} ${item.sum}`);
    lines.push(`${item.name}_count${formatLabels(item.labels)} ${item.count}`);
  }
  return lines;
}

function metricKey(name, labels) {
  return `${name}:${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join(",")}`;
}

function formatLabels(labels) {
  const entries = Object.entries(labels);
  if (!entries.length) return "";
  return `{${entries.map(([key, value]) => `${key}="${escapeLabel(value)}"`).join(",")}}`;
}

function escapeLabel(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}
