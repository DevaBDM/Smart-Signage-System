const MAX_LINES = 500;
const logs = new Map(); // streamId -> { lines: string[], lastAt: number }

function _ensure(id) {
  if (!logs.has(id)) {
    logs.set(id, { lines: [], lastAt: Date.now() });
  }
  return logs.get(id);
}

function append(id, line) {
  const buf = _ensure(id);
  const ts = new Date().toISOString();
  buf.lines.push(`[${ts}] ${line}`);
  if (buf.lines.length > MAX_LINES) {
    buf.lines.shift();
  }
  buf.lastAt = Date.now();
}

function get(id, limit = 100) {
  const buf = logs.get(id);
  if (!buf) return [];
  if (limit <= 0) return buf.lines.slice();
  return buf.lines.slice(-limit);
}

function clear(id) {
  logs.delete(id);
}

module.exports = { append, get, clear };
