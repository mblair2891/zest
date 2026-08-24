import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { staffGuestAccessPoints, useSingleOrigin, configuredHosts } from "@/lib/platform/hosts";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

export function AccessPointsCard({
  venueType,
  locationId,
  tablePath,
}: {
  venueType?: string;
  locationId?: string;
  tablePath?: string;
}) {
  const points = useMemo(
    () => staffGuestAccessPoints({ venueType, locationId, tablePath }),
    [venueType, locationId, tablePath],
  );
  const hosts = configuredHosts();
  const single = useSingleOrigin();
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div className="space-y-3" data-demo="access-points">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Staff and guest URLs</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {single
              ? "This environment is one origin. Production uses www, app, and sites hosts."
              : `www ${hosts.marketing} · app ${hosts.app} · sites ${hosts.sites}`}
          </p>
        </div>
        <GuideLearnLink topicId="access-urls" compact>
          Learn
        </GuideLearnLink>
      </div>
      <ul className="space-y-2">
        {points.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-[11px] text-muted-foreground">{p.hint}</p>
              <p className="mt-0.5 break-all text-[11px] tabular">{p.href}</p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(p.href);
                  setCopied(p.id);
                }}
              >
                {copied === p.id ? "Copied" : "Copy"}
              </Button>
              <Button type="button" size="sm" variant="ghost" asChild>
                <a href={p.href} target="_blank" rel="noreferrer">
                  Open
                </a>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
