export type BlogPost = {
  slug: string;
  title: string;
  date: string;
  dek: string;
  body: string[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "one-app-every-location",
    title: "One login. Every location.",
    date: "2026-08-12",
    dek: "Why Summex is a shared application — not a subdomain per restaurant.",
    body: [
      "Toast-style tenancy means your staff learn one product. After sign-in, Summex asks which organization and location you are working — then every request carries that context.",
      "We do not give each merchant their own POS hostname. That keeps SSO, training, and releases simple, and it is how the control plane at summex.app and the application at app.summex.app stay cleanly apart.",
    ],
  },
  {
    slug: "summex-payments-not-a-processor-picker",
    title: "Summex Payments is the card rail",
    date: "2026-08-04",
    dek: "Merchant processing is first-party. Software billing is a separate product.",
    body: [
      "Integrations never offer Stripe or Square as a POS processor. Checks capture through Summex Payments. Gift cards stay on our ledger.",
      "Stripe Billing may still collect Summex software fees. Those are subscriptions for the product — not guest card present volume.",
    ],
  },
  {
    slug: "food-halls-are-not-a-skin",
    title: "Food halls are a first-class tenant type",
    date: "2026-07-22",
    dek: "A hall is one organization, many merchants, one guest check.",
    body: [
      "Pick food hall at onboarding and the location inherits settlement, vendor portal, and host-cut packages. Restaurant locations on the same org stay on the full-service set.",
      "Memberships can be org-wide or pinned to a single location, so a cashier at Downtown never sees the commissary.",
    ],
  },
];

export function postBySlug(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
