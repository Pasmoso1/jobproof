/** Marketing resource library placeholders — add real assets later. */

export type PartnerResource = {
  id: string;
  title: string;
  category:
    | "logos"
    | "guidelines"
    | "social"
    | "email"
    | "web"
    | "print";
  description: string;
  /** Future: URL or storage path. Null = coming soon. */
  href: string | null;
};

export const PARTNER_RESOURCES: PartnerResource[] = [
  {
    id: "logo-primary",
    title: "JobProof logo (primary)",
    category: "logos",
    description: "Primary logo for light backgrounds.",
    href: null,
  },
  {
    id: "logo-mono",
    title: "JobProof logo (mono)",
    category: "logos",
    description: "Single-colour logo for restricted placements.",
    href: null,
  },
  {
    id: "brand-guidelines",
    title: "Brand guidelines",
    category: "guidelines",
    description: "Colours, typography, and usage rules.",
    href: null,
  },
  {
    id: "fb-graphic",
    title: "Facebook graphic",
    category: "social",
    description: "Square and feed-ready partner creative.",
    href: null,
  },
  {
    id: "ig-graphic",
    title: "Instagram graphic",
    category: "social",
    description: "Feed and story templates.",
    href: null,
  },
  {
    id: "li-graphic",
    title: "LinkedIn graphic",
    category: "social",
    description: "Professional feed creative.",
    href: null,
  },
  {
    id: "email-template",
    title: "Email introduction template",
    category: "email",
    description: "Short email you can personalize for contractors.",
    href: null,
  },
  {
    id: "web-banner",
    title: "Website banner",
    category: "web",
    description: "Banner sizes for partner websites.",
    href: null,
  },
  {
    id: "flyer",
    title: "Print flyer",
    category: "print",
    description: "One-page flyer for events and shops.",
    href: null,
  },
];

export const PARTNER_RESOURCE_CATEGORY_LABELS: Record<PartnerResource["category"], string> = {
  logos: "Logos",
  guidelines: "Brand guidelines",
  social: "Social graphics",
  email: "Email templates",
  web: "Website banners",
  print: "Flyers & print",
};
