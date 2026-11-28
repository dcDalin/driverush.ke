/**
 * three.js loaders that ask once more, after a short wait, when a download
 * fails. A phone on a weak line drops the odd file ("Load failed" on iPhones,
 * "Failed to fetch" in Chrome), and one dropped file shouldn't cost the
 * learner the board or the sign in front of them.
 *
 * This imports `three`, so only the lazily loaded 3D modules may import it
 * (`board-table.tsx`, `sign-3d-canvas.tsx`), never anything in the main bundle.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** How long to wait before the second ask. */
const RETRY_AFTER_MS = 1500;

export class SturdyGLTFLoader extends GLTFLoader {
  override load(
    url: string,
    onLoad: Parameters<GLTFLoader["load"]>[1],
    onProgress?: Parameters<GLTFLoader["load"]>[2],
    onError?: Parameters<GLTFLoader["load"]>[3],
  ): void {
    super.load(url, onLoad, onProgress, () => {
      window.setTimeout(
        () => super.load(url, onLoad, onProgress, onError),
        RETRY_AFTER_MS,
      );
    });
  }
}

/** A picture as a texture, asked for twice before giving up. */
export function loadSturdyTexture(url: string): Promise<THREE.Texture> {
  const loader = new THREE.TextureLoader();
  return loader.loadAsync(url).catch(
    () =>
      new Promise<THREE.Texture>((resolve, reject) => {
        window.setTimeout(() => {
          loader.loadAsync(url).then(resolve, () => {
            // The image loader fails with a DOM event, which has no message.
            reject(new Error(`Could not load ${url}`));
          });
        }, RETRY_AFTER_MS);
      }),
  );
}
