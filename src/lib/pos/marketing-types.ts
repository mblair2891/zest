/** Marketing, social, Google, and location websites */

export type SocialProvider =
  | "instagram"
  | "facebook"
  | "x"
  | "tiktok"
  | "google_business"
  | "youtube"
  | "linkedin"
  | "threads";

export type SocialConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending";

export interface SocialConnection {
  id: string;
  locationId: string;
  provider: SocialProvider;
  accountName: string;
  status: SocialConnectionStatus;
  connectedAt?: number;
  followers?: number;
  lastSyncAt?: number;
  scopes: string[];
}

export type PostStatus = "draft" | "scheduled" | "published" | "failed";

export interface MarketingPost {
  id: string;
  locationId: string;
  body: string;
  mediaLabel?: string;
  providers: SocialProvider[];
  status: PostStatus;
  scheduledAt?: number;
  publishedAt?: number;
  campaignTag?: string;
  createdAt: number;
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  /** points per $1 spent */
  pointsPerDollar: number;
  /** cents of reward per point when redeeming */
  redemptionValueCents: number;
  /** min points to redeem */
  minRedeemPoints: number;
  welcomeBonus: number;
  birthdayBonus: number;
  tiers: {
    id: string;
    name: string;
    minPoints: number;
    multiplier: number;
  }[];
  punchCardEnabled: boolean;
  punchTarget: number;
  punchRewardLabel: string;
}

export interface GiftCardTxn {
  id: string;
  giftCardId: string;
  type: "issue" | "reload" | "redeem" | "adjust" | "import" | "freeze" | "void";
  amountCents: number;
  note?: string;
  at: number;
  employeeName?: string;
}

export interface LocationWebsite {
  locationId: string;
  slug: string;
  published: boolean;
  theme: "citrus" | "noir" | "ocean" | "ember";
  tagline: string;
  about: string;
  heroTitle: string;
  ctaLabel: string;
  ctaHref: string;
  showMenu: boolean;
  showHours: boolean;
  showOrderOnline: boolean;
  showLoyalty: boolean;
  showGiftCards: boolean;
  showEvents: boolean;
  hoursText: string;
  seoTitle: string;
  seoDescription: string;
  primaryColor: string;
  socialLinks: { provider: SocialProvider; url: string }[];
  galleryLabels: string[];
  updatedAt: number;
}

export interface EmailSmsCampaign {
  id: string;
  name: string;
  channel: "email" | "sms" | "push";
  segment: string;
  status: "draft" | "scheduled" | "sent";
  audienceSize: number;
  body: string;
  scheduledAt?: number;
  sentAt?: number;
}
