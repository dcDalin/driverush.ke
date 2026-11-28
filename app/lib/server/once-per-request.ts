/**
 * A read shared by the loaders of one request. React Router hands every
 * loader of a request the same `Request`, so when a frame and the page in it
 * both need the same list (the console's bank requests: the frame's badge,
 * the page's list), the second asks for the first's answer instead of the
 * database. The next request reads afresh.
 */
const reads = new WeakMap<Request, Map<string, Promise<unknown>>>();

export function oncePerRequest<T>(
  request: Request,
  key: string,
  read: () => Promise<T>,
): Promise<T> {
  let byKey = reads.get(request);
  if (!byKey) {
    byKey = new Map();
    reads.set(request, byKey);
  }
  let pending = byKey.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = read();
    byKey.set(key, pending);
  }
  return pending;
}
