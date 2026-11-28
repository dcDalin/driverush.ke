/**
 * MDX bodies loaded one at a time, for routes where one file serves many
 * pages (the board guides, the sign classes, the blog). Importing every body
 * statically shipped all of them on every one of those pages; with this, a
 * page's JavaScript carries only its own text.
 *
 * - On the server (a request or the prerender), the route's `loader` awaits
 *   `load(file)`, so the body is ready before React renders and the HTML is
 *   complete.
 * - On a move from another page, the route's `clientLoader` awaits
 *   `load(file)` beside `serverLoader()`, so the page appears whole, with no
 *   fallback.
 * - On the first load, the page's HTML is already there; `<Body>` waits in a
 *   Suspense boundary for its chunk and React keeps the server's HTML on
 *   screen until it arrives, then hydrates it.
 */
import * as React from "react";

export type MdxModule = { default: React.ComponentType };
type Importers = Record<string, () => Promise<MdxModule>>;

export function mdxBodies(importers: Importers) {
  const ready = new Map<string, React.ComponentType>();
  const lazies = new Map<
    string,
    React.LazyExoticComponent<React.ComponentType>
  >();

  async function load(file: string): Promise<React.ComponentType> {
    const known = ready.get(file);
    if (known) return known;
    const importer = importers[file];
    if (!importer) throw new Error(`No MDX body at ${file}`);
    const Loaded = (await importer()).default;
    ready.set(file, Loaded);
    return Loaded;
  }

  function lazyBody(file: string) {
    let Lazy = lazies.get(file);
    if (!Lazy) {
      Lazy = React.lazy(() =>
        load(file).then((Loaded) => ({ default: Loaded })),
      );
      lazies.set(file, Lazy);
    }
    return Lazy;
  }

  /** The body at `file`: at once if loaded, else once its chunk arrives. */
  function Body({ file }: { file: string }) {
    const Loaded = ready.get(file) ?? lazyBody(file);
    return (
      <React.Suspense fallback={null}>
        <Loaded />
      </React.Suspense>
    );
  }

  return { load, Body, files: Object.keys(importers) };
}
