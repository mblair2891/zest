import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type {
  EmailSmsCampaign,
  GiftCardTxn,
  LocationWebsite,
  LoyaltyProgram,
  MarketingPost,
  SocialConnection,
  SocialProvider,
} from "./marketing-types";

const DEFAULT_LOYALTY: LoyaltyProgram = {
  id: "loy_default",
  name: "Summex Rewards",
  pointsPerDollar: 1,
  redemptionValueCents: 1,
  minRedeemPoints: 100,
  welcomeBonus: 50,
  birthdayBonus: 100,
  punchCardEnabled: true,
  punchTarget: 10,
  punchRewardLabel: "Free appetizer or well drink",
  tiers: [
    { id: "t1", name: "Standard", minPoints: 0, multiplier: 1 },
    { id: "t2", name: "Silver", minPoints: 250, multiplier: 1.25 },
    { id: "t3", name: "Gold", minPoints: 750, multiplier: 1.5 },
    { id: "t4", name: "Platinum", minPoints: 2000, multiplier: 2 },
  ],
};

function seedConnections(): SocialConnection[] {
  const now = Date.now();
  return [
    {
      id: "sc_ig",
      locationId: "loc_hall",
      provider: "instagram",
      accountName: "@summexmarkethall",
      status: "connected",
      connectedAt: now - 86400000 * 40,
      followers: 12400,
      lastSyncAt: now - 3600000,
      scopes: ["publish", "insights"],
    },
    {
      id: "sc_fb",
      locationId: "loc_hall",
      provider: "facebook",
      accountName: "Summex Market Hall",
      status: "connected",
      connectedAt: now - 86400000 * 40,
      followers: 8900,
      lastSyncAt: now - 7200000,
      scopes: ["pages_manage_posts", "pages_read_engagement"],
    },
    {
      id: "sc_gmb",
      locationId: "loc_hall",
      provider: "google_business",
      accountName: "Summex Market Hall · Google Business",
      status: "connected",
      connectedAt: now - 86400000 * 20,
      followers: 2100,
      lastSyncAt: now - 1800000,
      scopes: ["business.manage", "posts", "reviews"],
    },
    {
      id: "sc_x",
      locationId: "loc_rest",
      provider: "x",
      accountName: "@forgebistro",
      status: "disconnected",
      scopes: ["tweet.write"],
    },
    {
      id: "sc_tt",
      locationId: "loc_pod",
      provider: "tiktok",
      accountName: "@westsidepod",
      status: "pending",
      scopes: ["video.publish"],
    },
  ];
}

function seedPosts(): MarketingPost[] {
  const now = Date.now();
  return [
    {
      id: "mp1",
      locationId: "loc_hall",
      body: "Happy hour 4–6 · $2 off craft pours + bao bites. See you on the patio 🍋",
      mediaLabel: "Patio golden hour.jpg",
      providers: ["instagram", "facebook", "google_business"],
      status: "published",
      publishedAt: now - 86400000 * 2,
      campaignTag: "Happy hour",
      createdAt: now - 86400000 * 3,
    },
    {
      id: "mp2",
      locationId: "loc_hall",
      body: "Weekend lineup: Smoke Stack BBQ, Bao Wow, Green Grid. Live DJ Sat 7pm.",
      providers: ["instagram", "facebook"],
      status: "scheduled",
      scheduledAt: now + 86400000,
      campaignTag: "Weekend",
      createdAt: now - 3600000,
    },
    {
      id: "mp3",
      locationId: "loc_rest",
      body: "Chef's tasting Friday — 5 courses, wine pairings available. Book now.",
      providers: ["instagram", "google_business"],
      status: "draft",
      createdAt: now - 600000,
    },
  ];
}

function seedWebsites(): LocationWebsite[] {
  const now = Date.now();
  return [
    {
      locationId: "loc_hall",
      slug: "summex-market-hall",
      published: true,
      theme: "citrus",
      tagline: "Five kitchens. One check. Zero hassle.",
      about:
        "Summex Market Hall brings independent food & beverage vendors under one roof — order across stalls, pay once, and hang on the pier patio.",
      heroTitle: "Eat the hall",
      ctaLabel: "Order online",
      ctaHref: "/online",
      showMenu: true,
      showHours: true,
      showOrderOnline: true,
      showLoyalty: true,
      showGiftCards: true,
      showEvents: true,
      hoursText: "Sun–Thu 11a–10p · Fri–Sat 11a–12a",
      seoTitle: "Summex Market Hall | Food hall on the pier",
      seoDescription:
        "Multi-vendor food hall with single-check checkout, live music, and Summex Rewards.",
      primaryColor: "#c8f542",
      socialLinks: [
        { provider: "instagram", url: "https://instagram.com/summexmarkethall" },
        { provider: "facebook", url: "https://facebook.com/summexmarkethall" },
      ],
      galleryLabels: ["Patio", "Bao counter", "Bar rail", "Night market"],
      updatedAt: now,
    },
    {
      locationId: "loc_rest",
      slug: "forge-bistro",
      published: true,
      theme: "ember",
      tagline: "Fire, seasonality, neighborhood tables.",
      about:
        "Forge Bistro is a full-service neighborhood restaurant — wood-fired plates, craft cocktails, and Summex Rewards at the door.",
      heroTitle: "Tonight at Forge",
      ctaLabel: "Reserve a table",
      ctaHref: "/?station=waitlist",
      showMenu: true,
      showHours: true,
      showOrderOnline: true,
      showLoyalty: true,
      showGiftCards: true,
      showEvents: false,
      hoursText: "Tue–Sun 5p–10p · Closed Mon",
      seoTitle: "Forge Bistro",
      seoDescription: "Neighborhood bistro with wood-fired cooking.",
      primaryColor: "#e5a320",
      socialLinks: [{ provider: "instagram", url: "https://instagram.com/forgebistro" }],
      galleryLabels: ["Dining room", "Open kitchen"],
      updatedAt: now,
    },
    {
      locationId: "loc_pod",
      slug: "westside-truck-pod",
      published: false,
      theme: "noir",
      tagline: "Rotating trucks. Real power. Good vibes.",
      about: "Westside Truck Pod — pad map, power, and tonight's lineup.",
      heroTitle: "Tonight's trucks",
      ctaLabel: "See lineup",
      ctaHref: "/?station=truck_pod",
      showMenu: false,
      showHours: true,
      showOrderOnline: true,
      showLoyalty: false,
      showGiftCards: true,
      showEvents: true,
      hoursText: "Daily 11a–9p",
      seoTitle: "Westside Truck Pod",
      seoDescription: "Food truck pod with rotating vendors.",
      primaryColor: "#5b9fd4",
      socialLinks: [],
      galleryLabels: ["Lot at dusk"],
      updatedAt: now,
    },
  ];
}

function seedCampaigns(): EmailSmsCampaign[] {
  return [
    {
      id: "em1",
      name: "Win-back 30 days",
      channel: "email",
      segment: "Lapsed 30d",
      status: "draft",
      audienceSize: 420,
      body: "We miss you — here's 100 bonus Summex Rewards points this week.",
    },
    {
      id: "em2",
      name: "Gift card push",
      channel: "sms",
      segment: "Gold+ tier",
      status: "scheduled",
      audienceSize: 88,
      body: "Gold members: buy $50 gift card, get $10 bonus loaded today.",
      scheduledAt: Date.now() + 86400000 * 2,
    },
    {
      id: "em3",
      name: "Weekend SMS blast",
      channel: "sms",
      segment: "Opt-in SMS",
      status: "sent",
      audienceSize: 1204,
      body: "Sat DJ + patio fire pits. Open late.",
      sentAt: Date.now() - 86400000 * 5,
    },
  ];
}

interface MarketingState {
  loyalty: LoyaltyProgram;
  connections: SocialConnection[];
  posts: MarketingPost[];
  websites: LocationWebsite[];
  campaigns: EmailSmsCampaign[];
  giftTxns: GiftCardTxn[];
  activeLocationId: string;

  setActiveLocation: (id: string) => void;
  updateLoyalty: (p: Partial<LoyaltyProgram>) => void;
  connectSocial: (
    locationId: string,
    provider: SocialProvider,
    accountName: string,
  ) => void;
  disconnectSocial: (id: string) => void;
  createPost: (
    p: Omit<MarketingPost, "id" | "createdAt" | "status"> & {
      status?: MarketingPost["status"];
    },
  ) => void;
  schedulePost: (id: string, when: number) => void;
  publishPost: (id: string) => void;
  updateWebsite: (locationId: string, patch: Partial<LocationWebsite>) => void;
  publishWebsite: (locationId: string, published: boolean) => void;
  sendCampaign: (id: string) => void;
  createCampaign: (c: Omit<EmailSmsCampaign, "id" | "status">) => void;
  logGiftTxn: (t: Omit<GiftCardTxn, "id" | "at">) => void;
  websiteBySlug: (slug: string) => LocationWebsite | undefined;
}

export const useMarketingStore = create<MarketingState>()(
  persist(
    (set, get) => ({
      loyalty: DEFAULT_LOYALTY,
      connections: seedConnections(),
      posts: seedPosts(),
      websites: seedWebsites(),
      campaigns: seedCampaigns(),
      giftTxns: [],
      activeLocationId: "loc_hall",

      setActiveLocation: (id) => set({ activeLocationId: id }),

      updateLoyalty: (p) =>
        set({ loyalty: { ...get().loyalty, ...p } }),

      connectSocial: (locationId, provider, accountName) => {
        const existing = get().connections.find(
          (c) => c.locationId === locationId && c.provider === provider,
        );
        if (existing) {
          set({
            connections: get().connections.map((c) =>
              c.id === existing.id
                ? {
                    ...c,
                    accountName,
                    status: "connected",
                    connectedAt: Date.now(),
                    lastSyncAt: Date.now(),
                  }
                : c,
            ),
          });
          return;
        }
        set({
          connections: [
            {
              id: uid("sc"),
              locationId,
              provider,
              accountName,
              status: "connected",
              connectedAt: Date.now(),
              lastSyncAt: Date.now(),
              followers: Math.floor(Math.random() * 5000) + 200,
              scopes: ["publish"],
            },
            ...get().connections,
          ],
        });
      },

      disconnectSocial: (id) => {
        set({
          connections: get().connections.map((c) =>
            c.id === id ? { ...c, status: "disconnected" } : c,
          ),
        });
      },

      createPost: (p) => {
        set({
          posts: [
            {
              ...p,
              id: uid("mp"),
              createdAt: Date.now(),
              status: p.status ?? "draft",
            },
            ...get().posts,
          ],
        });
      },

      schedulePost: (id, when) => {
        set({
          posts: get().posts.map((p) =>
            p.id === id
              ? { ...p, status: "scheduled", scheduledAt: when }
              : p,
          ),
        });
      },

      publishPost: (id) => {
        set({
          posts: get().posts.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: "published",
                  publishedAt: Date.now(),
                  scheduledAt: undefined,
                }
              : p,
          ),
        });
      },

      updateWebsite: (locationId, patch) => {
        const list = get().websites;
        const hit = list.find((w) => w.locationId === locationId);
        if (!hit) {
          set({
            websites: [
              {
                locationId,
                slug: patch.slug ?? locationId,
                published: false,
                theme: "citrus",
                tagline: "",
                about: "",
                heroTitle: "Welcome",
                ctaLabel: "Order",
                ctaHref: "/online",
                showMenu: true,
                showHours: true,
                showOrderOnline: true,
                showLoyalty: true,
                showGiftCards: true,
                showEvents: false,
                hoursText: "",
                seoTitle: "",
                seoDescription: "",
                primaryColor: "#c8f542",
                socialLinks: [],
                galleryLabels: [],
                updatedAt: Date.now(),
                ...patch,
              },
              ...list,
            ],
          });
          return;
        }
        set({
          websites: list.map((w) =>
            w.locationId === locationId
              ? { ...w, ...patch, updatedAt: Date.now() }
              : w,
          ),
        });
      },

      publishWebsite: (locationId, published) => {
        get().updateWebsite(locationId, { published });
      },

      sendCampaign: (id) => {
        set({
          campaigns: get().campaigns.map((c) =>
            c.id === id
              ? { ...c, status: "sent", sentAt: Date.now() }
              : c,
          ),
        });
      },

      createCampaign: (c) => {
        set({
          campaigns: [
            { ...c, id: uid("em"), status: "draft" },
            ...get().campaigns,
          ],
        });
      },

      logGiftTxn: (t) => {
        set({
          giftTxns: [
            { ...t, id: uid("gtx"), at: Date.now() },
            ...get().giftTxns,
          ],
        });
      },

      websiteBySlug: (slug) =>
        get().websites.find(
          (w) => w.slug.toLowerCase() === slug.toLowerCase(),
        ),
    }),
    {
      name: "summex-marketing-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const SOCIAL_LABEL: Record<SocialProvider, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  x: "X (Twitter)",
  tiktok: "TikTok",
  google_business: "Google Business",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  threads: "Threads",
};
