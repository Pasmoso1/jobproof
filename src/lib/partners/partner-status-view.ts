import type { PartnerAccountStatusView } from "@/lib/partners/session";

export const PARTNER_STATUS_LOGIN_HREF = `/login?next=${encodeURIComponent("/partner/status")}`;
export const PARTNER_STATUS_APPLY_HREF = "/partners/apply";
export const PARTNER_STATUS_DASHBOARD_HREF = "/dashboard";
export const PARTNER_STATUS_PROGRAM_HREF = "/partners";
export const PARTNER_STATUS_PORTAL_HREF = "/partner";

export type PartnerStatusAction = {
  label: string;
  href?: string;
  /** Client-handled sign-out then login redirect. */
  kind?: "sign_in_another_account";
  variant: "primary" | "secondary" | "tertiary" | "text";
};

export type PartnerStatusPageView = {
  title: string;
  paragraphs: string[];
  showSignedInBanner: boolean;
  signedInEmail: string | null;
  showEmailVerificationNotice: boolean;
  actions: PartnerStatusAction[];
};

export function buildPartnerStatusPageView(input: {
  signedIn: boolean;
  signedInEmail: string | null;
  status: PartnerAccountStatusView | null;
}): PartnerStatusPageView {
  if (!input.signedIn) {
    return {
      title: "Sign in to view your partner application",
      paragraphs: [
        "Use the username or email and password you selected when submitting your Partner Program application.",
      ],
      showSignedInBanner: false,
      signedInEmail: null,
      showEmailVerificationNotice: false,
      actions: [
        {
          label: "Sign in to check status",
          href: PARTNER_STATUS_LOGIN_HREF,
          variant: "primary",
        },
        {
          label: "Apply to Partner Program",
          href: PARTNER_STATUS_APPLY_HREF,
          variant: "secondary",
        },
      ],
    };
  }

  const status = input.status;
  const email = input.signedInEmail;

  if (!status || status.kind === "none") {
    return {
      title: "We can’t find a partner application for the account currently signed in",
      paragraphs: [
        "If you already applied, your application may be linked to a different JobProof username or email address. Sign out, then sign in using the username or email you chose when submitting your Partner Program application.",
        "If you have not applied yet, you can start a new Partner Program application.",
      ],
      showSignedInBanner: Boolean(email),
      signedInEmail: email,
      showEmailVerificationNotice: false,
      actions: [
        {
          label: "Sign in with another account",
          kind: "sign_in_another_account",
          variant: "primary",
        },
        {
          label: "Apply to Partner Program",
          href: PARTNER_STATUS_APPLY_HREF,
          variant: "secondary",
        },
        {
          label: "Go to contractor dashboard",
          href: PARTNER_STATUS_DASHBOARD_HREF,
          variant: "tertiary",
        },
        {
          label: "Return to Partner Program",
          href: PARTNER_STATUS_PROGRAM_HREF,
          variant: "text",
        },
      ],
    };
  }

  if (status.kind === "active" && !status.emailVerified) {
    return {
      title: "Approved — confirm your email",
      paragraphs: [
        "Your partner application is approved. Confirm your email address to open the Partner Portal.",
      ],
      showSignedInBanner: Boolean(email),
      signedInEmail: email,
      showEmailVerificationNotice: true,
      actions: [
        {
          label: "Try Partner Portal",
          href: PARTNER_STATUS_PORTAL_HREF,
          variant: "primary",
        },
        {
          label: "Go to contractor dashboard",
          href: PARTNER_STATUS_DASHBOARD_HREF,
          variant: "secondary",
        },
      ],
    };
  }

  if (status.kind === "partner_inactive") {
    if (status.status === "suspended") {
      return {
        title: "Partner account suspended",
        paragraphs: [
          "Your partner account is suspended. Contact JobProof support if you believe this is a mistake.",
        ],
        showSignedInBanner: Boolean(email),
        signedInEmail: email,
        showEmailVerificationNotice: !status.emailVerified,
        actions: [
          {
            label: "Go to contractor dashboard",
            href: PARTNER_STATUS_DASHBOARD_HREF,
            variant: "primary",
          },
          {
            label: "Return to Partner Program",
            href: PARTNER_STATUS_PROGRAM_HREF,
            variant: "text",
          },
        ],
      };
    }
    return {
      title: "Partner account inactive",
      paragraphs: [
        "Your partner account is not currently active. Contact JobProof support for help.",
      ],
      showSignedInBanner: Boolean(email),
      signedInEmail: email,
      showEmailVerificationNotice: !status.emailVerified,
      actions: [
        {
          label: "Go to contractor dashboard",
          href: PARTNER_STATUS_DASHBOARD_HREF,
          variant: "primary",
        },
        {
          label: "Return to Partner Program",
          href: PARTNER_STATUS_PROGRAM_HREF,
          variant: "text",
        },
      ],
    };
  }

  // Matching application
  if (status.kind === "application") {
    if (status.status === "submitted") {
      return {
        title: "Application submitted",
        paragraphs: [
          status.organizationName
            ? `Thanks — we received your application for ${status.organizationName}. Our team will review it and email you when there is an update.`
            : "Thanks — we received your partner application. Our team will review it and email you when there is an update.",
        ],
        showSignedInBanner: Boolean(email),
        signedInEmail: email,
        showEmailVerificationNotice: !status.emailVerified,
        actions: [
          {
            label: "Go to contractor dashboard",
            href: PARTNER_STATUS_DASHBOARD_HREF,
            variant: "secondary",
          },
          {
            label: "Return to Partner Program",
            href: PARTNER_STATUS_PROGRAM_HREF,
            variant: "text",
          },
        ],
      };
    }
    if (status.status === "under_review") {
      return {
        title: "Application under review",
        paragraphs: [
          "Your partner application is under review. We’ll email you when a decision is ready.",
        ],
        showSignedInBanner: Boolean(email),
        signedInEmail: email,
        showEmailVerificationNotice: !status.emailVerified,
        actions: [
          {
            label: "Go to contractor dashboard",
            href: PARTNER_STATUS_DASHBOARD_HREF,
            variant: "secondary",
          },
          {
            label: "Return to Partner Program",
            href: PARTNER_STATUS_PROGRAM_HREF,
            variant: "text",
          },
        ],
      };
    }
    if (status.status === "declined") {
      return {
        title: "Application declined",
        paragraphs: [
          "We’re not able to approve your partner application at this time. You can still use JobProof as a contractor if you have an account.",
        ],
        showSignedInBanner: Boolean(email),
        signedInEmail: email,
        showEmailVerificationNotice: !status.emailVerified,
        actions: [
          {
            label: "Return to Partner Program",
            href: PARTNER_STATUS_PROGRAM_HREF,
            variant: "primary",
          },
          {
            label: "Go to contractor dashboard",
            href: PARTNER_STATUS_DASHBOARD_HREF,
            variant: "secondary",
          },
        ],
      };
    }
    return {
      title: "Approved — portal available",
      paragraphs: [
        "Your application was approved. Open the Partner Portal to continue.",
      ],
      showSignedInBanner: Boolean(email),
      signedInEmail: email,
      showEmailVerificationNotice: !status.emailVerified,
      actions: [
        {
          label: "Open Partner Portal",
          href: PARTNER_STATUS_PORTAL_HREF,
          variant: "primary",
        },
        {
          label: "Go to contractor dashboard",
          href: PARTNER_STATUS_DASHBOARD_HREF,
          variant: "secondary",
        },
      ],
    };
  }

  // Exhaustive fallback — treat as wrong-account without claiming no application exists.
  return {
    title: "We can’t find a partner application for the account currently signed in",
    paragraphs: [
      "If you already applied, your application may be linked to a different JobProof username or email address. Sign out, then sign in using the username or email you chose when submitting your Partner Program application.",
      "If you have not applied yet, you can start a new Partner Program application.",
    ],
    showSignedInBanner: Boolean(email),
    signedInEmail: email,
    showEmailVerificationNotice: false,
    actions: [
      {
        label: "Sign in with another account",
        kind: "sign_in_another_account",
        variant: "primary",
      },
      {
        label: "Apply to Partner Program",
        href: PARTNER_STATUS_APPLY_HREF,
        variant: "secondary",
      },
      {
        label: "Go to contractor dashboard",
        href: PARTNER_STATUS_DASHBOARD_HREF,
        variant: "tertiary",
      },
      {
        label: "Return to Partner Program",
        href: PARTNER_STATUS_PROGRAM_HREF,
        variant: "text",
      },
    ],
  };
}
