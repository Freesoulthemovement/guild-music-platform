/**
 * Timestamped console logging.
 *
 * Lives in its own module rather than in index.ts: index.ts starts the HTTP
 * server as a side effect of being imported, so anything importing `log` from
 * there would boot a second server.
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
