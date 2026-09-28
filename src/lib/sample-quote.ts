import type { CustomerProposalSnapshot } from "@/lib/public-estimate-proposal";
import { invoiceTaxShortLabel } from "@/lib/invoice-tax";

export const SAMPLE_QUOTE_PATH = "/sample-quote";

/** Fictional contractor shown on the public sample quote. 555 number and example.com email are reserved for fiction. */
export const SAMPLE_QUOTE_CONTRACTOR = {
  businessName: "Northline Decks & Renovations",
  contactName: "Alex Chen",
  phone: "(905) 555-0142",
  email: "quotes@example.com",
} as const;

export const SAMPLE_QUOTE_META = {
  title: "Backyard Deck Replacement",
  estimateNumberLabel: "Quote #1042",
  issueDateLabel: "May 6",
  expiryDateLabel: "June 5",
  propertyAddressLines: ["123 Example Street", "Oakville, Ontario"],
} as const;

const SUBTOTAL = 12000;
const TAX_RATE = 0.13;
const TAX_AMOUNT = Math.round(SUBTOTAL * TAX_RATE * 100) / 100;
const TOTAL = SUBTOTAL + TAX_AMOUNT;

export const SAMPLE_QUOTE_PROPOSAL: CustomerProposalSnapshot = {
  welcomeMessage:
    "Thanks for considering Northline Decks & Renovations for your backyard deck replacement. This proposal walks through the work we are recommending and what to expect next.",
  projectTitle: SAMPLE_QUOTE_META.title,
  projectSummary:
    "Remove the existing deck and build a new 12 × 16 ft pressure-treated deck with stairs and railings, based on the photos you sent and our site visit.",
  scopeOfWork: [
    "Remove and dispose of the existing deck, stairs and railings.",
    "Install new footings and pressure-treated framing to code.",
    "Install new pressure-treated decking, stairs and railings.",
    "Final walkthrough with you once the work is complete.",
  ],
  includedWork: [
    "All labour and materials listed in the scope of work",
    "Building permit application and required inspections",
    "Daily site cleanup and final debris removal",
  ],
  optionalUpgrades: [
    {
      title: "Composite decking",
      description: "Low-maintenance composite boards instead of pressure-treated wood.",
      additionalPrice: 3800,
    },
    {
      title: "Stair lighting",
      description: "Low-voltage lights on each stair riser.",
      additionalPrice: 650,
    },
  ],
  exclusions: [
    "Landscaping or sod repair beyond the work area",
    "Staining or sealing (recommended after the wood has dried)",
  ],
  pricingItems: [
    {
      label: "Remove existing deck and build new 12 × 16 ft deck",
      amount: 11200,
      description: "Footings, framing, decking, stairs and railings.",
    },
    {
      label: "Permits and required coordination",
      amount: 450,
      description: "Any standard permits or coordination already included in this quote.",
    },
    {
      label: "Finishing details and project closeout",
      amount: 350,
      description: "Any remaining quoted work needed to complete the project as proposed.",
    },
  ],
  timeline: {
    duration: "5–7 working days",
    startWindow: "Within 3 weeks of acceptance",
    completion: "Confirmed once the permit is issued",
    fallbackText: null,
  },
  warranty: "2-year workmanship warranty on all labour.\nMaterials are covered by the manufacturer's warranty.",
  questionsOrChangesIntro:
    "If you have a question or would like anything adjusted, send a note here and your contractor will review it with this quote.",
  nextSteps: [
    "We'll call you to confirm your preferred start date.",
    "We'll apply for the building permit.",
    "A deposit is due before materials are ordered.",
  ],
  subtotal: SUBTOTAL,
  taxAmount: TAX_AMOUNT,
  taxRateLabel: invoiceTaxShortLabel("ON"),
  total: TOTAL,
  depositAmount: 3000,
};
