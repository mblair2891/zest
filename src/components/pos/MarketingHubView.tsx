import { useEffect, useMemo, useState } from "react";
import {
  Megaphone,
  Share2,
  Globe,
  Link2,
  Send,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { useMarketingStore, SOCIAL_LABEL } from "@/lib/pos/marketing-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { usePosStore } from "@/lib/pos/store";
import type { SocialProvider } from "@/lib/pos/marketing-types";
import { formatDateTime } from "@/lib/utils";

type Tab = "social" | "posts" | "campaigns" | "loyalty" | "website";

const PROVIDERS: SocialProvider[] = [
  "instagram",
  "facebook",
  "google_business",
  "x",
  "tiktok",
  "youtube",
  "threads",
  "linkedin",
];

export function MarketingHubView() {
  const view = usePosStore((s) => s.view);
  const [tab, setTab] = useState<Tab>(
    view === "website" ? "website" : "social",
  );
  const locations = useSaasStore((s) => s.locations);
  const activeLocationId = useMarketingStore((s) => s.activeLocationId);
  const setActiveLocation = useMarketingStore((s) => s.setActiveLocation);
  const connections = useMarketingStore((s) => s.connections);
  const posts = useMarketingStore((s) => s.posts);
  const campaigns = useMarketingStore((s) => s.campaigns);
  const websites = useMarketingStore((s) => s.websites);
  const loyalty = useMarketingStore((s) => s.loyalty);
  const connectSocial = useMarketingStore((s) => s.connectSocial);
  const disconnectSocial = useMarketingStore((s) => s.disconnectSocial);
  const createPost = useMarketingStore((s) => s.createPost);
  const publishPost = useMarketingStore((s) => s.publishPost);
  const schedulePost = useMarketingStore((s) => s.schedulePost);
  const sendCampaign = useMarketingStore((s) => s.sendCampaign);
  const updateLoyalty = useMarketingStore((s) => s.updateLoyalty);
  const updateWebsite = useMarketingStore((s) => s.updateWebsite);
  const publishWebsite = useMarketingStore((s) => s.publishWebsite);
  const setView = usePosStore((s) => s.setView);

  const [postBody, setPostBody] = useState("");
  const [postProviders, setPostProviders] = useState<SocialProvider[]>([
    "instagram",
    "facebook",
    "google_business",
  ]);
  const [connectProvider, setConnectProvider] =
    useState<SocialProvider>("instagram");
  const [connectName, setConnectName] = useState("");

  useEffect(() => {
    if (view === "website") setTab("website");
    else if (view === "marketing") setTab("social");
  }, [view]);

  const locConns = useMemo(
    () => connections.filter((c) => c.locationId === activeLocationId),
    [connections, activeLocationId],
  );
  const locPosts = useMemo(
    () => posts.filter((p) => p.locationId === activeLocationId),
    [posts, activeLocationId],
  );
  const site = websites.find((w) => w.locationId === activeLocationId);

  const locName =
    locations.find((l) => l.id === activeLocationId)?.name ?? activeLocationId;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Marketing & growth</h2>
          <Badge variant="info">Social · CRM · Websites · Loyalty</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect social + Google Business, schedule posts, run SMS/email, tune
          rewards, and publish a location website.
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {locations.map((l) => (
            <Button
              key={l.id}
              size="sm"
              variant={activeLocationId === l.id ? "default" : "outline"}
              onClick={() => setActiveLocation(l.id)}
            >
              {l.name}
            </Button>
          ))}
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {(
            [
              ["social", "Social & Google"],
              ["posts", "Posts"],
              ["campaigns", "Email / SMS"],
              ["loyalty", "Loyalty program"],
              ["website", "Location website"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "social" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="mb-1 text-sm font-semibold">
                Connected accounts · {locName}
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                Demo connect — live OAuth with Meta, Google, TikTok, X when API
                keys are configured. Posts still schedule in-app.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PROVIDERS.map((p) => {
                  const hit = locConns.find((c) => c.provider === p);
                  return (
                    <div
                      key={p}
                      className="flex items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5"
                    >
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {SOCIAL_LABEL[p]}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {hit?.accountName ?? "Not connected"}
                          {hit?.followers
                            ? ` · ${hit.followers.toLocaleString()} followers`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          hit?.status === "connected"
                            ? "success"
                            : hit?.status === "pending"
                              ? "warn"
                              : "secondary"
                        }
                      >
                        {hit?.status ?? "off"}
                      </Badge>
                      {hit?.status === "connected" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => disconnectSocial(hit.id)}
                        >
                          Disconnect
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            connectSocial(
                              activeLocationId,
                              p,
                              connectName ||
                                `@${locName.replace(/\s+/g, "").toLowerCase()}`,
                            );
                          }}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <select
                  className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
                  value={connectProvider}
                  onChange={(e) =>
                    setConnectProvider(e.target.value as SocialProvider)
                  }
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {SOCIAL_LABEL[p]}
                    </option>
                  ))}
                </select>
                <Input
                  className="h-9 max-w-xs"
                  placeholder="Account handle / page name"
                  value={connectName}
                  onChange={(e) => setConnectName(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    connectSocial(
                      activeLocationId,
                      connectProvider,
                      connectName || "Business page",
                    );
                    setConnectName("");
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect selected
                </Button>
              </div>
            </div>
          </div>
        )}

        {tab === "posts" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="mb-2 text-sm font-semibold">Compose</h3>
              <VoiceTextarea
                className="min-h-[100px] bg-bg"
                placeholder="Write a post for social + Google…"
                value={postBody}
                onChange={setPostBody}
                rows={4}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {PROVIDERS.slice(0, 5).map((p) => {
                  const on = postProviders.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setPostProviders((prev) =>
                          on ? prev.filter((x) => x !== p) : [...prev, p],
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] ${
                        on
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface-2 text-muted-foreground"
                      }`}
                    >
                      {SOCIAL_LABEL[p]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!postBody.trim() || postProviders.length === 0}
                  onClick={() => {
                    createPost({
                      locationId: activeLocationId,
                      body: postBody.trim(),
                      providers: postProviders,
                      status: "draft",
                    });
                    setPostBody("");
                  }}
                >
                  Save draft
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!postBody.trim()}
                  onClick={() => {
                    createPost({
                      locationId: activeLocationId,
                      body: postBody.trim(),
                      providers: postProviders,
                      status: "scheduled",
                      scheduledAt: Date.now() + 3600000 * 4,
                    });
                    setPostBody("");
                  }}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Schedule +4h
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!postBody.trim()}
                  onClick={() => {
                    createPost({
                      locationId: activeLocationId,
                      body: postBody.trim(),
                      providers: postProviders,
                      status: "published",
                    });
                    setPostBody("");
                  }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Publish now (demo)
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {locPosts.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        p.status === "published"
                          ? "success"
                          : p.status === "scheduled"
                            ? "info"
                            : "secondary"
                      }
                    >
                      {p.status}
                    </Badge>
                    {p.providers.map((pr) => (
                      <span
                        key={pr}
                        className="text-[10px] text-muted-foreground"
                      >
                        {SOCIAL_LABEL[pr]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm">{p.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.publishedAt
                      ? `Published ${formatDateTime(p.publishedAt)}`
                      : p.scheduledAt
                        ? `Scheduled ${formatDateTime(p.scheduledAt)}`
                        : `Draft · ${formatDateTime(p.createdAt)}`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {p.status !== "published" && (
                      <Button size="sm" onClick={() => publishPost(p.id)}>
                        Publish
                      </Button>
                    )}
                    {p.status === "draft" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          schedulePost(p.id, Date.now() + 86400000)
                        }
                      >
                        Schedule tomorrow
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "campaigns" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Segmented email / SMS to loyalty members (demo send).
            </p>
            {campaigns.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.channel} · {c.segment} · {c.audienceSize} guests
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.body}</p>
                </div>
                <Badge
                  variant={
                    c.status === "sent"
                      ? "success"
                      : c.status === "scheduled"
                        ? "info"
                        : "secondary"
                  }
                >
                  {c.status}
                </Badge>
                {c.status !== "sent" && (
                  <Button size="sm" onClick={() => sendCampaign(c.id)}>
                    Send now
                  </Button>
                )}
              </div>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView("campaigns")}
            >
              Open classic CRM campaigns
            </Button>
          </div>
        )}

        {tab === "loyalty" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold">{loyalty.name}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs">
                  Points per $1
                  <Input
                    type="number"
                    className="mt-1"
                    value={loyalty.pointsPerDollar}
                    onChange={(e) =>
                      updateLoyalty({
                        pointsPerDollar: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  Min redeem points
                  <Input
                    type="number"
                    className="mt-1"
                    value={loyalty.minRedeemPoints}
                    onChange={(e) =>
                      updateLoyalty({
                        minRedeemPoints: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  Welcome bonus
                  <Input
                    type="number"
                    className="mt-1"
                    value={loyalty.welcomeBonus}
                    onChange={(e) =>
                      updateLoyalty({
                        welcomeBonus: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="text-xs">
                  Birthday bonus
                  <Input
                    type="number"
                    className="mt-1"
                    value={loyalty.birthdayBonus}
                    onChange={(e) =>
                      updateLoyalty({
                        birthdayBonus: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>
              <Button
                size="sm"
                className="mt-3"
                variant="outline"
                onClick={() => setView("customers")}
              >
                Open guests & gift cards
              </Button>
            </div>
          </div>
        )}

        {tab === "website" && site && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Location website</h3>
              <Badge variant={site.published ? "success" : "secondary"}>
                {site.published ? "Published" : "Draft"}
              </Badge>
              <a
                href={`/site/${site.slug}`}
                className="text-xs text-primary underline"
              >
                /site/{site.slug}
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs">
                Slug
                <Input
                  className="mt-1"
                  value={site.slug}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
              </label>
              <label className="text-xs">
                Hero title
                <Input
                  className="mt-1"
                  value={site.heroTitle}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      heroTitle: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs sm:col-span-2">
                Tagline
                <Input
                  className="mt-1"
                  value={site.tagline}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      tagline: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs sm:col-span-2">
                About
                <div className="mt-1">
                  <VoiceTextarea
                    className="min-h-[80px] bg-bg"
                    value={site.about}
                    onChange={(about) =>
                      updateWebsite(activeLocationId, { about })
                    }
                    rows={4}
                  />
                </div>
              </label>
              <label className="text-xs">
                Hours
                <Input
                  className="mt-1"
                  value={site.hoursText}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      hoursText: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs">
                CTA label
                <Input
                  className="mt-1"
                  value={site.ctaLabel}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      ctaLabel: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs">
                SEO title
                <Input
                  className="mt-1"
                  value={site.seoTitle}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      seoTitle: e.target.value,
                    })
                  }
                />
              </label>
              <label className="text-xs">
                Theme
                <select
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
                  value={site.theme}
                  onChange={(e) =>
                    updateWebsite(activeLocationId, {
                      theme: e.target.value as typeof site.theme,
                    })
                  }
                >
                  <option value="citrus">Citrus</option>
                  <option value="noir">Noir</option>
                  <option value="ocean">Ocean</option>
                  <option value="ember">Ember</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {(
                [
                  ["showMenu", "Menu"],
                  ["showHours", "Hours"],
                  ["showOrderOnline", "Order online"],
                  ["showLoyalty", "Loyalty"],
                  ["showGiftCards", "Gift cards"],
                  ["showEvents", "Events"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    updateWebsite(activeLocationId, {
                      [key]: !site[key],
                    })
                  }
                  className={`rounded-full px-2.5 py-1 ${
                    site[key]
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => publishWebsite(activeLocationId, true)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Publish site
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => publishWebsite(activeLocationId, false)}
              >
                Unpublish
              </Button>
              <a href={`/site/${site.slug}`}>
                <Button size="sm" variant="secondary">
                  Preview public site
                </Button>
              </a>
            </div>
          </div>
        )}
        {tab === "website" && !site && (
          <p className="text-sm text-muted-foreground">
            No website yet for this location.
          </p>
        )}
      </div>
    </div>
  );
}
