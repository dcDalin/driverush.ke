import { Link } from "react-router";

import { Icon } from "~/components/brand/icon";
import { ArrowRightIcon } from "~/components/brand/icons";
import { Button } from "~/components/ui/button";
import { TOOLS } from "~/lib/tools";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/index";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Tools · DriveRush" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export default function ToolsIndex() {
  return (
    <div>
      <header className="border-b border-line pb-6">
        <span className="eyebrow text-ink">Internal · authoring</span>
        <h1 className="m-0 mt-3 font-display text-[clamp(32px,5vw,52px)] leading-[0.95] font-semibold tracking-tighter">
          DriveRush <span className="text-rush">tools</span>
        </h1>
        <p className="mt-4 max-w-2xl font-serif text-[clamp(16px,2vw,20px)] leading-tight text-ink-2">
          Small in-browser utilities for building the hardcoded learning content
          — start with the image-coordinate mapper for the road-sign trainers.
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {TOOLS.map((tool) => {
          const soon = tool.status === "soon";
          return (
            <article
              key={tool.slug}
              className={cn(
                "flex h-full flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-stamp",
                soon && "opacity-60",
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-3 text-ink">
                  <Icon icon={tool.icon} size={24} />
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[10.5px] tracking-widest text-ink-3 uppercase">
                    {soon ? "Planned" : "Tool"}
                  </span>
                  <h2 className="m-0 mt-1.5 font-display text-[clamp(20px,2.4vw,26px)] leading-[0.95] font-semibold tracking-tight">
                    {tool.title}
                  </h2>
                </div>
              </div>
              <p className="m-0 text-[14.5px] leading-relaxed text-ink-2">
                {tool.blurb}
              </p>
              <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
                {soon ? (
                  <span className="font-mono text-[11px] tracking-widest text-ink-3 uppercase">
                    Coming soon
                  </span>
                ) : (
                  <Button variant="ink" size="lg" asChild>
                    <Link to={tool.path}>
                      Open
                      <Icon icon={ArrowRightIcon} size={16} />
                    </Link>
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
