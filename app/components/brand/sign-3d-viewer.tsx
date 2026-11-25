/**
 * Client-only wrapper around the react-three-fiber scene. The heavy 3D module
 * (`sign-3d-canvas.tsx`, which imports `three` + drei) is pulled in via
 * `React.lazy` **after mount**, so it never runs during SSR and forms its own
 * async chunk. Until it's ready — and on the server / first paint — we show the
 * house traffic-light loader.
 *
 * A download that fails twice (a weak line, a deploy that renamed the files)
 * says so here and offers another go, rather than taking the page down.
 *
 * Auto-rotate is suppressed under `prefers-reduced-motion`.
 */
import * as React from "react";

import { LoadingPanel } from "~/components/brand/traffic-loader";
import { Button } from "~/components/ui/button";
import { analytics } from "~/lib/analytics";
import { cn } from "~/lib/utils";

const loadCanvas = () => import("~/components/brand/sign-3d-canvas");

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The message and the button, over the space the sign would fill. On a card of
 * its own, so it reads on the day sky and the night backdrop alike.
 */
function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
      <div
        role="alert"
        className="flex max-w-sm flex-col items-center gap-4 rounded-lg border border-line bg-surface px-5 py-4 text-center shadow-xs"
      >
        <p className="m-0 text-[15px] leading-snug text-ink">
          {what} did not finish loading. Check your connection and try again.
        </p>
        <Button variant="rush" onClick={onRetry} className="font-bold">
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Catches the trainer's own code failing to download, or anything else that
 * escapes the canvas. A sign's model failing is caught inside the canvas
 * instead (`ModelGuard`), so the canvas lives on.
 */
class CanvasGuard extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    analytics.signs3dLoadFailed({ reason: "download" });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type Sign3DViewerProps = {
  modelSrc: string | null | undefined;
  /** Told each time a model actually reaches the screen. */
  onModelReady?: (modelSrc: string) => void;
  yaw?: number;
  pitch?: number;
  zoom?: number;
  autoRotate?: boolean;
  interactive?: boolean;
  /** Caption shown under the loader while the scene boots. */
  loaderLabel?: string;
  /** Light loader caption, for the dark fullscreen overlay. */
  onDark?: boolean;
  className?: string;
};

export function Sign3DViewer({
  modelSrc,
  onModelReady,
  yaw,
  pitch,
  zoom,
  autoRotate = false,
  interactive = true,
  loaderLabel = "Loading the sign",
  onDark = false,
  className,
}: Sign3DViewerProps) {
  const [mounted, setMounted] = React.useState(false);
  const reducedMotion = usePrefersReducedMotion();
  React.useEffect(() => setMounted(true), []);

  // A fresh lazy component per try at the code, since a failed import stays
  // failed. Online, a try loads the page afresh instead: after a deploy the
  // old files are gone, so only the new build's can ever arrive.
  const [code, setCode] = React.useState(() => ({
    n: 0,
    Canvas: React.lazy(loadCanvas),
  }));
  const retryCode = React.useCallback(() => {
    if (navigator.onLine !== false) {
      window.location.reload();
      return;
    }
    setCode((was) => ({ n: was.n + 1, Canvas: React.lazy(loadCanvas) }));
  }, []);

  // The model that failed twice, and the count of tries at it.
  const [failedModel, setFailedModel] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);
  const onModelFailed = React.useCallback((src: string) => {
    setFailedModel(src);
    analytics.signs3dLoadFailed({ reason: "model", model: src });
  }, []);
  const retryModel = React.useCallback(() => {
    setFailedModel(null);
    setAttempt((n) => n + 1);
  }, []);

  const loader = (
    <div className="flex h-full w-full items-center justify-center">
      <LoadingPanel label={loaderLabel} size="lg" onDark={onDark} />
    </div>
  );

  const { Canvas } = code;
  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {!mounted || !modelSrc ? (
        loader
      ) : (
        <CanvasGuard
          key={code.n}
          fallback={<LoadFailed what="The 3D trainer" onRetry={retryCode} />}
        >
          <React.Suspense fallback={loader}>
            {/* One Canvas for the session — swapping `modelSrc` reloads only the
                model (from cache) and re-fits the camera; we deliberately do NOT
                key the Canvas, to avoid recreating the WebGL context per sign. */}
            <Canvas
              modelSrc={modelSrc}
              onModelReady={onModelReady}
              onModelFailed={onModelFailed}
              attempt={attempt}
              yaw={yaw}
              pitch={pitch}
              zoom={zoom}
              autoRotate={autoRotate && !reducedMotion}
              interactive={interactive}
            />
          </React.Suspense>
          {failedModel === modelSrc && (
            <LoadFailed what="The sign" onRetry={retryModel} />
          )}
        </CanvasGuard>
      )}
    </div>
  );
}
