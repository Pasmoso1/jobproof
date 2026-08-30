/** Marketing resource library + partner sales copy helpers. */

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

/** Ready-to-use partner intro language (no guaranteed-income claims). */
export const PARTNER_SALES_COPY = {
  introduction:
    "JobProof gives contractors tools to help turn opportunities into paying jobs — from quote requests and professional quotes to contracts, change orders, invoices and job documentation.",
  socialShort:
    "More jobs. Better processes. Better protection. JobProof helps contractors manage the journey from quote request to payment.",
  mainMessage:
    "JobProof isn't just about paperwork. It's a business tool designed to help contractors win more work, make more money, and protect the work they've earned.",
  supporting:
    "Saving time, looking professional, staying organized and reducing disputes are important benefits — but they support the bigger goal of running a more successful contracting business.",
  conversationSteps: [
    {
      title: "Find the pain",
      body: "Ask how the contractor currently gets leads, handles quote requests, follows up, manages contracts and gets paid.",
    },
    {
      title: "Connect the opportunity",
      body: "Explain how JobProof can help turn more of that activity into organized, paying work.",
    },
    {
      title: "Show the workflow",
      body: "Quote request → Quote → Signed agreement → Job → Changes → Invoice → Documentation",
    },
    {
      title: "Lead with the outcome",
      body: "More opportunities converted into work, better control over payment, and less revenue lost through poor processes or disputes.",
    },
    {
      title: "Share your referral link",
      body: "Let the contractor explore JobProof and start their trial.",
    },
  ],
} as const;

export const MARKETING_PARTNER_POLICY = {
  title: "Marketing Partner guidelines",
  intro:
    "Marketing Partners promote JobProof through their own channels and earn referral rewards for qualified contractor customers. JobProof does not hire Marketing Partners as agencies and does not automatically cover advertising costs unless agreed in writing.",
  mustNot: [
    "Make false or misleading claims about JobProof",
    "Promise that JobProof will increase a contractor's income or job volume",
    "Pretend to be JobProof",
    "Create websites or social accounts that impersonate JobProof",
    "Spam potential customers",
    "Send unsolicited bulk messages where prohibited",
    "Bid on JobProof trademarks or brand terms in paid search without written permission",
    "Offer unauthorized discounts",
    "Promise features JobProof does not provide",
    "Manipulate referral attribution",
    "Refer themselves solely to collect a commission",
    "Use fraudulent, fake, or duplicate accounts",
    "Misrepresent pricing",
    "Use deceptive advertising",
  ],
  closing:
    "JobProof may decline rewards for referrals that appear fraudulent or improperly generated. Rewards become payable only after the existing qualification rules are met.",
} as const;
