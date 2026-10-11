import { ImageResponse } from "next/og";
import { QUOTE_LINK_PREVIEW_IMAGE_SIZE } from "@/lib/quote-requests/link-preview";

function businessNameFontSize(name: string): number {
  if (name.length <= 22) return 72;
  if (name.length <= 36) return 58;
  if (name.length <= 56) return 46;
  return 38;
}

export function businessInitials(name: string): string {
  return name
    .split(" ")
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "")
    .join("")
    .toUpperCase();
}

/** 1200×630 link-preview card led by the contractor's own branding. */
export function renderQuoteLinkPreviewImage(input: {
  businessName: string;
  tradeLabel: string | null;
  logoDataUri: string | null;
  cacheControl: string;
}): ImageResponse {
  const { businessName, tradeLabel, logoDataUri, cacheControl } = input;
  const monogram = businessInitials(businessName);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          padding: "56px 80px 40px",
          color: "#18181b",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
          }}
        >
          {logoDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoDataUri}
              alt=""
              width={520}
              height={190}
              style={{ objectFit: "contain", marginBottom: 36 }}
            />
          ) : monogram ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 150,
                height: 150,
                borderRadius: 75,
                backgroundColor: "#27272a",
                color: "#ffffff",
                fontSize: 64,
                marginBottom: 36,
              }}
            >
              {monogram}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              textAlign: "center",
              justifyContent: "center",
              maxWidth: 1040,
              fontSize: businessNameFontSize(businessName),
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            {businessName || "Request a Quote"}
          </div>
          {tradeLabel ? (
            <div style={{ display: "flex", marginTop: 14, fontSize: 30, color: "#52525b" }}>
              {tradeLabel}
            </div>
          ) : null}
          {businessName ? (
            <div
              style={{
                display: "flex",
                marginTop: 34,
                padding: "14px 34px",
                borderRadius: 999,
                backgroundColor: "#18181b",
                color: "#ffffff",
                fontSize: 32,
              }}
            >
              Request a Quote
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontSize: 20, color: "#a1a1aa" }}>Powered by JobProof</div>
      </div>
    ),
    {
      ...QUOTE_LINK_PREVIEW_IMAGE_SIZE,
      headers: { "Cache-Control": cacheControl },
    }
  );
}
