/*
 * DriveRush's service worker: the board is ready to drive with no connection
 * from the moment the app is installed, the pages and levels a learner has
 * opened keep working offline, and the board's big files are not downloaded
 * twice.
 *
 * Four rules:
 *  - On install, the Board page, the game's page and everything the game
 *    needs to run are saved (see `precache`). A learner on data saver gets the
 *    two pages only; the game's files then come with its first open.
 *  - The build's own files carry a hash in their name and never change, so
 *    they are served from the cache once fetched.
 *  - Pages and their data are always asked of the network first. The cache is
 *    only the fallback when there is no connection, so a deploy is seen on the
 *    very next visit. A page never opened shows `/offline.html`.
 *  - Other files of ours (the board's cars, pictures, sounds) are served from
 *    the cache and refreshed in the background.
 *
 * To throw every cache away after a bad release, bump VERSION.
 */
const VERSION = "v2";
const FILES = `dr-files-${VERSION}`;
const PAGES = `dr-pages-${VERSION}`;
const KEEP = [FILES, PAGES];

/** A file Vite built: `/assets/name-HASH.js`. Its content never changes. */
const HASHED = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?)$/;
const STATIC =
  /\.(?:glb|gltf|png|jpe?g|webp|avif|svg|ico|mp3|ogg|wav|woff2?|json|webmanifest)$/;

/** The pages saved on install. The first is where the app opens. */
const PAGES_TO_SAVE = ["/model-town-board", "/model-town-board/play"];
const OFFLINE = "/offline.html";
/** Small files every screen uses. */
const SHELL = [
  OFFLINE,
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/logo-dark.svg",
];
/** The board's cars and still, from `app/lib/board/cars.ts` and `board-thumb.tsx`. */
const BOARD_FILES = [
  "/assets/board/cars/saloon.glb?v=5",
  "/assets/board/cars/hatchback.glb?v=5",
  "/assets/board/cars/wagon.glb?v=5",
  "/assets/board/cars/pickup.glb?v=5",
  "/assets/board/cars/suv.glb?v=5",
  "/assets/board/cars/van.glb?v=1",
  "/assets/board/cars/lorry.glb?v=1",
  "/assets/board/poster.jpg",
];
/** Every built file the game needs, lazy ones too. Written by `vite.config.ts`. */
const GAME_LIST = "/sw-board.json";

/** The built files a page's HTML loads first: its scripts and stylesheets. */
function assetsIn(html) {
  const found = new Set();
  for (const tag of html.match(/<(?:link|script)\b[^>]*>/g) ?? []) {
    const url = /\b(?:href|src)="(\/assets\/[^"]+)"/.exec(tag)?.[1];
    if (!url) continue;
    if (
      tag.startsWith("<script") ||
      /\brel="(?:modulepreload|stylesheet)"/.test(tag)
    ) {
      found.add(url);
    }
  }
  return [...found];
}

async function save(cacheName, url) {
  const response = await fetch(url, { cache: "no-cache" });
  await put(cacheName, new Request(url), response);
  return response;
}

/** On data saver, only the pages: the game's files come with its first open. */
function lite() {
  return self.navigator.connection?.saveData === true;
}

/** The game's file list for this build, or null (a dev build, no network). */
async function fetchGameList() {
  try {
    const response = await fetch(GAME_LIST, { cache: "no-cache" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** The list the saved files came from, kept to see when a deploy changes it. */
async function savedGameList() {
  const hit = await caches.match(GAME_LIST, { cacheName: PAGES });
  return hit ? hit.json().catch(() => null) : null;
}

async function precache(gameList) {
  const assets = new Set();

  await Promise.allSettled([
    ...SHELL.map((url) => save(FILES, url)),
    ...PAGES_TO_SAVE.map(async (url) => {
      const response = await save(PAGES, url);
      if (!response.ok) return;
      for (const asset of assetsIn(await response.clone().text())) {
        assets.add(asset);
      }
    }),
  ]);

  if (gameList) {
    for (const url of gameList) assets.add(url);
    for (const url of BOARD_FILES) assets.add(url);
  }

  // Already saved by an earlier version: hashed files never change.
  const cache = await caches.open(FILES);
  const missing = [];
  for (const url of assets) {
    if (!(await caches.match(url))) missing.push(url);
  }
  // A few at a time, so a cheap phone on a slow line is not swamped.
  for (let i = 0; i < missing.length; i += 6) {
    await Promise.allSettled(
      missing.slice(i, i + 6).map(async (url) => {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      }),
    );
  }
  if (gameList) {
    const pages = await caches.open(PAGES);
    await pages.put(
      GAME_LIST,
      new Response(JSON.stringify(gameList), {
        headers: { "content-type": "application/json" },
      }),
    );
  }
}

/**
 * After a deploy. `sw.js` itself rarely changes, so the browser does not
 * install it again and `install` does not run: the page asks for this instead
 * each time it opens (see `root.tsx`). One small file is fetched; only when
 * the game's list differs are the new files saved and the old build's game
 * files thrown away.
 */
async function refresh() {
  if (lite()) return;
  const fresh = await fetchGameList();
  if (!fresh) return;
  const old = await savedGameList();
  if (old && JSON.stringify(old) === JSON.stringify(fresh)) return;
  await precache(fresh);
  if (!old) return;
  const keep = new Set(fresh);
  const files = await caches.open(FILES);
  for (const url of old) {
    if (!keep.has(url)) await files.delete(url);
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "refresh") event.waitUntil(refresh().catch(() => {}));
});

self.addEventListener("install", (event) => {
  // Never fails: anything not saved now is saved when it is first opened.
  event.waitUntil(
    (async () => precache(lite() ? null : await fetchGameList()))().catch(
      () => {},
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("dr-") && !KEEP.includes(name)) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })(),
  );
});

async function put(cacheName, request, response) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  await put(FILES, request, response);
  return response;
}

async function refreshBehind(request) {
  const hit = await caches.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      await put(FILES, request, response);
      return response;
    })
    .catch(() => null);
  if (hit) return hit;
  const response = await fresh;
  return response ?? Response.error();
}

async function networkFirst(request, isPage) {
  try {
    const response = await fetch(request);
    await put(PAGES, request, response);
    return response;
  } catch (error) {
    const hit =
      (await caches.match(request)) ??
      // The same page with another query: the game's page is one page
      // whatever level it opens on, and the app opens with `?source=pwa`.
      (await caches.match(request, { ignoreSearch: true }));
    if (hit) return hit;
    if (isPage) {
      // A page never opened. Not another page's HTML at this address: it
      // would start up as the wrong page.
      const offline = await caches.match(OFFLINE);
      if (offline) return offline;
    }
    throw error;
  }
}

/**
 * The routes the app asks for before moving to a page it has not loaded
 * (`/__manifest?paths=…&version=…`). The query is the whole answer: which
 * pages, for which build. So only that exact answer may come from the cache.
 * Another one would tell the app the page does not exist ("No route
 * matches"). Without it, the app is told to load the page whole, which the
 * page cache or `/offline.html` then answers.
 */
async function routes(request) {
  try {
    const response = await fetch(request);
    await put(PAGES, request, response);
    return response;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    return new Response(null, {
      status: 204,
      headers: { "X-Remix-Reload-Document": "true" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Analytics and anything else not ours is left alone.
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, true));
    return;
  }
  if (HASHED.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  // Only this worker reads the game's list, and it keeps its own copy.
  if (url.pathname === GAME_LIST) return;
  if (url.pathname === "/__manifest") {
    event.respondWith(routes(request));
    return;
  }
  // The data a page loads when it is moved to without a full load.
  if (url.pathname.endsWith(".data")) {
    event.respondWith(networkFirst(request, false));
    return;
  }
  if (STATIC.test(url.pathname)) {
    event.respondWith(refreshBehind(request));
  }
});
