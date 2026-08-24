/**
 * Normalize Creator profile/channel input and generic partner profile links.
 * Accepts domain-only entries and platform handles; stores https URLs.
 */

export type ProfileLinkResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type HandleMode = "none" | "path" | "at-path" | "at-required";

type PlatformLinkSpec = {
  id: string;
  label: string;
  hosts: readonly string[];
  handleMode: HandleMode;
  placeholder: string;
  mismatchError: string;
};

const HANDLE_RE = /^[A-Za-z0-9._]{1,64}$/;

export const CREATOR_PROFILE_FIELD_HINT =
  "Enter your profile, channel link, or username. You don't need to include https:// or www.";

export const ADDITIONAL_PROFILE_LINKS_HINT =
  "Other profiles, one per line or comma-separated. You don't need to include https:// or www.";

export const CREATOR_PLATFORM_LINK_SPECS: readonly PlatformLinkSpec[] = [
  {
    id: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    handleMode: "path",
    placeholder: "instagram.com/yourname or @yourname",
    mismatchError:
      "That doesn't look like an Instagram profile. Please check the link or username.",
  },
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com"],
    handleMode: "at-required",
    placeholder: "youtube.com/@yourchannel or @yourchannel",
    mismatchError:
      "That doesn't look like a YouTube channel. Please check the link or username.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    hosts: ["tiktok.com"],
    handleMode: "at-path",
    placeholder: "tiktok.com/@yourname or @yourname",
    mismatchError:
      "That doesn't look like a TikTok profile. Please check the link or username.",
  },
  {
    id: "facebook",
    label: "Facebook",
    hosts: ["facebook.com", "fb.com"],
    handleMode: "path",
    placeholder: "facebook.com/yourpage",
    mismatchError:
      "That doesn't look like a Facebook page. Please check the link or username.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    hosts: ["linkedin.com"],
    handleMode: "none",
    placeholder: "linkedin.com/in/yourname",
    mismatchError:
      "That doesn't look like a LinkedIn profile. Please include a LinkedIn link.",
  },
  {
    id: "podcast",
    label: "Podcast",
    hosts: [],
    handleMode: "none",
    placeholder: "yourshow.com or podcasts.apple.com/…",
    mismatchError:
      "Enter a podcast or profile link. You don't need to include https:// or www.",
  },
  {
    id: "other",
    label: "Other",
    hosts: [],
    handleMode: "none",
    placeholder: "yourprofile.com/yourname",
    mismatchError:
      "Enter a website or profile link. You don't need to include https:// or www.",
  },
] as const;

const UNSAFE_SCHEME_RE =
  /^(javascript|data|file|vbscript|about|blob|intent):/i;

const GENERIC_UNSAFE_ERROR =
  "That link doesn't look safe. Please use a regular https website or profile link.";

const GENERIC_INVALID_ERROR =
  "Enter a website or profile link. You don't need to include https:// or www.";

export function creatorProfilePlaceholder(platform: string | null | undefined): string {
  return (
    CREATOR_PLATFORM_LINK_SPECS.find((s) => s.id === platform)?.placeholder ??
    "instagram.com/yourname or @yourname"
  );
}

export function normalizeCreatorProfileLink(
  platform: string,
  raw: string
): ProfileLinkResult {
  const spec = CREATOR_PLATFORM_LINK_SPECS.find((s) => s.id === platform);
  if (!spec) {
    return { ok: false, error: "Select your primary platform." };
  }

  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: "Add your profile or channel." };
  }

  if (UNSAFE_SCHEME_RE.test(trimmed)) {
    return { ok: false, error: GENERIC_UNSAFE_ERROR };
  }

  const handle = tryNormalizeHandle(spec, trimmed);
  if (handle) return handle;
  if (handleLooksLikeRejectedHandle(spec, trimmed)) {
    return { ok: false, error: spec.mismatchError };
  }

  const generic = normalizeExternalHttpsUrl(trimmed);
  if (!generic.ok) {
    return {
      ok: false,
      error: generic.error === GENERIC_UNSAFE_ERROR ? generic.error : spec.mismatchError,
    };
  }

  if (spec.hosts.length > 0 && !hostMatchesPlatform(generic.url, spec.hosts)) {
    return { ok: false, error: spec.mismatchError };
  }

  const pathname = new URL(generic.url).pathname.replace(/\/+$/, "");
  if (spec.hosts.length > 0 && (!pathname || pathname === "/")) {
    return { ok: false, error: spec.mismatchError };
  }

  return { ok: true, url: canonicalizePlatformUrl(generic.url, spec) };
}

export function normalizeAdditionalProfileLinks(raw: string): ProfileLinkResult & {
  urls?: string[];
} {
  const parts = splitLinkList(raw);
  if (parts.length === 0) {
    return { ok: true, url: "", urls: [] };
  }

  const urls: string[] = [];
  for (const part of parts) {
    if (looksLikeBareHandle(part)) {
      return { ok: false, error: GENERIC_INVALID_ERROR };
    }
    const result = normalizeExternalHttpsUrl(part);
    if (!result.ok) return result;
    urls.push(result.url);
  }
  return { ok: true, url: urls.join("\n"), urls };
}

/**
 * Generic public https URL. Accepts domain-only input; does not invent a
 * hostname from a bare handle.
 */
export function normalizeExternalHttpsUrl(raw: string): ProfileLinkResult {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, error: GENERIC_INVALID_ERROR };
  }

  if (UNSAFE_SCHEME_RE.test(trimmed) || looksLikeBareHandle(trimmed)) {
    return {
      ok: false,
      error: UNSAFE_SCHEME_RE.test(trimmed)
        ? GENERIC_UNSAFE_ERROR
        : GENERIC_INVALID_ERROR,
    };
  }

  let candidate = trimmed.replace(/^\/\//, "https://");
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, error: GENERIC_INVALID_ERROR };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: GENERIC_UNSAFE_ERROR };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: GENERIC_UNSAFE_ERROR };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, error: GENERIC_UNSAFE_ERROR };
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  const host = stripWww(parsed.hostname);
  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
  const search = parsed.search;
  return { ok: true, url: `https://${host}${path}${search}` };
}

function splitLinkList(raw: string): string[] {
  return String(raw ?? "")
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksLikeBareHandle(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("@")) return true;
  if (trimmed.includes("/") || trimmed.includes("://")) return false;
  if (trimmed.includes(".")) return false;
  return HANDLE_RE.test(trimmed);
}

function handleLooksLikeRejectedHandle(
  spec: PlatformLinkSpec,
  trimmed: string
): boolean {
  if (!looksLikeBareHandle(trimmed)) return false;
  if (spec.handleMode === "none") return true;
  if (spec.handleMode === "at-required" && !trimmed.startsWith("@")) return true;
  return false;
}

function tryNormalizeHandle(
  spec: PlatformLinkSpec,
  trimmed: string
): ProfileLinkResult | null {
  if (spec.handleMode === "none") return null;
  if (!looksLikeBareHandle(trimmed)) return null;

  if (spec.handleMode === "at-required" && !trimmed.startsWith("@")) {
    return null;
  }

  const handle = trimmed.replace(/^@/, "");
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, error: spec.mismatchError };
  }

  const host = spec.hosts[0];
  if (!host) return { ok: false, error: spec.mismatchError };

  if (spec.handleMode === "at-path" || spec.handleMode === "at-required") {
    return { ok: true, url: `https://${host}/@${handle}` };
  }
  return { ok: true, url: `https://${host}/${handle}` };
}

function hostMatchesPlatform(url: string, hosts: readonly string[]): boolean {
  const hostname = stripWww(new URL(url).hostname);
  return hosts.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

function canonicalizePlatformUrl(url: string, spec: PlatformLinkSpec): string {
  const parsed = new URL(url);
  const host = spec.hosts[0] ?? stripWww(parsed.hostname);
  const path = parsed.pathname.replace(/\/+$/, "") || "";
  return `https://${host}${path}${parsed.search}`;
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, "").toLowerCase();
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "::1"
  ) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map((n) => Number(n));
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}
