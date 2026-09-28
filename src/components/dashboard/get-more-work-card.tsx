"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import {
  COMPLETE_BUSINESS_PROFILE_PATH,
  QUOTE_REQUEST_SETTINGS_PATH,
  buildQuoteLinkIntro,
  buildQuoteLinkMessage,
  buildSmsHref,
  normalizeCustomerMobileNumber,
} from "@/lib/quote-link-share";

const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-[#2436BB] px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2";

const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function GetMoreWorkCard({
  quoteUrl,
  businessName,
  variant,
  profileReady,
}: {
  quoteUrl: string | null;
  businessName: string | null;
  variant: "prominent" | "compact";
  profileReady: boolean;
}) {
  const compact = variant === "compact";
  const headingId = useId();
  const phoneInputId = useId();
  const phoneHelpId = useId();
  const phoneErrorId = useId();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const message = quoteUrl ? buildQuoteLinkMessage({ businessName, quoteUrl }) : "";

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quoteUrl) return;
    const normalized = normalizeCustomerMobileNumber(phone);
    if (!normalized) {
      setPhoneError("Enter a valid mobile number, e.g. 416-555-0123.");
      return;
    }
    setPhoneError(null);
    setStatus("Opening your messages app with the quote link ready to send.");
    window.location.href = buildSmsHref(normalized, message);
  }

  async function handleCopy() {
    if (!quoteUrl) return;
    const ok = await copyText(quoteUrl);
    setStatus(ok ? "Quote link copied." : `Couldn't copy automatically. Your link is ${quoteUrl}`);
  }

  async function handleShare() {
    if (!quoteUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Request a quote",
          text: buildQuoteLinkIntro(businessName),
          url: quoteUrl,
        });
        setStatus("");
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    const ok = await copyText(quoteUrl);
    setStatus(
      ok
        ? "Sharing isn't available on this device, so the quote link was copied instead."
        : `Sharing isn't available on this device. Your link is ${quoteUrl}`
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-xl border border-[#2436BB]/25 bg-white shadow-sm ${compact ? "p-4 sm:p-5" : "p-5 sm:p-8"}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2436BB]">
        Get more work
      </p>
      <h2
        id={headingId}
        className={`mt-1 font-bold tracking-tight text-zinc-900 ${compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"}`}
      >
        Get your next job
      </h2>
      <p className={`mt-2 max-w-xl text-zinc-600 ${compact ? "text-sm" : "text-sm sm:text-base"}`}>
        {profileReady
          ? "Give customers an easy way to tell you what they need and request a quote."
          : "Complete your business profile so customers can tell you what they need and request a quote."}
      </p>

      {!profileReady ? (
        <div className={compact ? "mt-4" : "mt-4 sm:mt-6"}>
          <Link href={COMPLETE_BUSINESS_PROFILE_PATH} className={primaryButtonClassName}>
            Complete your profile
          </Link>
        </div>
      ) : quoteUrl ? (
        <>
          <form
            onSubmit={handleSend}
            noValidate
            className={`mt-4 flex flex-col gap-3 ${compact ? "sm:flex-row sm:items-end" : "sm:mt-6 sm:flex-row sm:items-end"}`}
          >
            <div className="min-w-0 flex-1 sm:max-w-xs">
              <label htmlFor={phoneInputId} className="block text-sm font-medium text-zinc-800">
                Customer&apos;s mobile number
              </label>
              <input
                id={phoneInputId}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
                placeholder="416-555-0123"
                aria-describedby={phoneError ? `${phoneHelpId} ${phoneErrorId}` : phoneHelpId}
                aria-invalid={phoneError ? true : undefined}
                className="mt-1 block min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#2436BB] focus:outline-none focus:ring-2 focus:ring-[#2436BB]/30"
              />
            </div>
            <button type="submit" className={primaryButtonClassName}>
              Send quote link
            </button>
          </form>
          <p id={phoneHelpId} className="mt-2 text-xs text-zinc-500">
            Opens your phone&apos;s messages app with a short message and your quote link ready to
            send.
          </p>
          {phoneError ? (
            <p id={phoneErrorId} role="alert" className="mt-1 text-sm text-red-700">
              {phoneError}
            </p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3 sm:flex sm:flex-wrap">
            <button type="button" onClick={() => void handleCopy()} className={secondaryButtonClassName}>
              Copy link
            </button>
            <button type="button" onClick={() => setQrOpen(true)} className={secondaryButtonClassName}>
              Show QR code
            </button>
            <button type="button" onClick={() => void handleShare()} className={secondaryButtonClassName}>
              Share
            </button>
          </div>
          <p aria-live="polite" className="mt-2 min-h-5 break-words text-sm text-zinc-700">
            {status}
          </p>

          <QuoteQrDialog open={qrOpen} quoteUrl={quoteUrl} onClose={() => setQrOpen(false)} />
        </>
      ) : (
        <div className={compact ? "mt-4" : "mt-4 sm:mt-6"}>
          <Link href={QUOTE_REQUEST_SETTINGS_PATH} className={primaryButtonClassName}>
            Set up your quote link
          </Link>
          <p className="mt-2 text-xs text-zinc-500">
            Choose your quote page address once, then send it to customers in seconds.
          </p>
        </div>
      )}
    </section>
  );
}

function QuoteQrDialog({
  open,
  quoteUrl,
  onClose,
}: {
  open: boolean;
  quoteUrl: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);
  const [qrFailedFor, setQrFailedFor] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || qr?.url === quoteUrl) return;
    let cancelled = false;
    void import("qrcode")
      .then((mod) =>
        mod.default.toDataURL(quoteUrl, { width: 480, margin: 2, errorCorrectionLevel: "M" })
      )
      .then((dataUrl) => {
        if (!cancelled) setQr({ url: quoteUrl, dataUrl });
      })
      .catch(() => {
        if (!cancelled) setQrFailedFor(quoteUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [open, quoteUrl, qr?.url]);

  const dataUrl = qr?.url === quoteUrl ? qr.dataUrl : null;
  const failed = qrFailedFor === quoteUrl && !dataUrl;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-900/50"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
            Your quote request QR code
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR code"
            className="-mr-2 -mt-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB]"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        <p id={descriptionId} className="mt-1 text-sm text-zinc-600">
          Customers can scan this code to request a quote from you.
        </p>
        <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-lg border border-zinc-200 bg-white">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="QR code that opens your Request a Quote page"
              className="h-full w-full object-contain"
            />
          ) : (
            <p className="px-4 text-center text-sm text-zinc-500">
              {failed ? "Couldn't create the QR code. Use Copy link instead." : "Creating QR code…"}
            </p>
          )}
        </div>
        <p className="mt-3 break-all text-center text-xs text-zinc-500">{quoteUrl}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {dataUrl ? (
            <a
              href={dataUrl}
              download="jobproof-quote-qr.png"
              className={`${secondaryButtonClassName} flex-1`}
            >
              Download QR code
            </a>
          ) : null}
          <button type="button" onClick={onClose} className={`${secondaryButtonClassName} flex-1`}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
