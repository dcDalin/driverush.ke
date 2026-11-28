/**
 * How a link fetches the next page ahead (React Router's `prefetch`): on
 * intent (hover, focus or the start of a tap), so the page's code and data
 * are usually there by the time the tap ends. Not on a phone that asked to
 * save data or is on 2G: there, every byte is the learner's, and only what
 * they open is loaded.
 */
type Connection = { saveData?: boolean; effectiveType?: string };

export function linkPrefetch(): "intent" | "none" {
  if (typeof navigator === "undefined") return "intent";
  const connection = (navigator as Navigator & { connection?: Connection })
    .connection;
  if (connection?.saveData) return "none";
  if (
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "slow-2g"
  )
    return "none";
  return "intent";
}
