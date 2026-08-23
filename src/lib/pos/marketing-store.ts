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
  name: "Zest Rewards",
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
  return [];
}

function seedPosts(): MarketingPost[] {
  return [];
}

function seedWebsites(): LocationWebsite[] {
  return [];
}

function seedCampaigns(): EmailSmsCampaign[] {
  return [];
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
      activeLocationId: "",

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
      name: "zest-marketing-v2-empty",
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
