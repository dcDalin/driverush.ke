/**
 * `?livery=<id>`: DriveRush staff see a livery (a draft too) on the board and
 * the tool pages before it goes live. The livery is read with the staff
 * member's own session (`admin_livery_draft_get` refuses anyone else) and
 * held for the tab like `?sponsor=`. Supabase is loaded only when asked.
 */
import * as React from "react";
import { useSearchParams } from "react-router";

import { type Sponsor, toSponsor } from "./school-catalog";
import { holdPreview } from "./sponsor-visit";

export type LiveryPreview =
  | { state: "none" }
  | { state: "loading" }
  | { state: "ready"; sponsor: Sponsor }
  | { state: "refused" };

export function useLiveryPreview(): LiveryPreview {
  const [params] = useSearchParams();
  const id = params.get("livery");
  const [preview, setPreview] = React.useState<LiveryPreview>({
    state: "none",
  });

  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    setPreview({ state: "loading" });
    void (async () => {
      try {
        const [{ getSupabaseBrowserClient }, { getLiveryPreview }] =
          await Promise.all([
            import("~/database/supabase/browser"),
            import("~/database/schools/board-schools"),
          ]);
        const row = await getLiveryPreview(getSupabaseBrowserClient(), id);
        if (!alive) return;
        if (!row) return setPreview({ state: "refused" });
        const sponsor = toSponsor(row, import.meta.env.VITE_SUPABASE_URL);
        holdPreview(sponsor);
        setPreview({ state: "ready", sponsor });
      } catch {
        if (alive) setPreview({ state: "refused" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  return id ? preview : { state: "none" };
}
