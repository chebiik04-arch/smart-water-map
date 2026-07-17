export function log(level, message, fields = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields
  };
  const line = JSON.stringify(payload);
  if (level === "error" || level === "fatal") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  debug: (message, fields) => log("debug", message, fields),
  info: (message, fields) => log("info", message, fields),
  warn: (message, fields) => log("warn", message, fields),
  error: (message, fields) => log("error", message, fields),
  fatal: (message, fields) => log("fatal", message, fields)
};
