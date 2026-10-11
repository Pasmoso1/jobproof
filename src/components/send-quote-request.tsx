"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  QUOTE_LINK_WEBSITE_GUIDANCE,
  buildQuoteLinkIntro,
  buildQuoteLinkMessage,
  buildSmsHref,
  normalizeCustomerMobileNumber,
} from "@/lib/quote-link-share";
import {
  QUOTE_REQUEST_SHARE_EVENTS,
  trackQuoteRequestShare,
  type QuoteRequestShareSource,
} from "@/lib/quote-request-share-analytics";

export const SEND_QUOTE_REQUEST_LABEL = "Send Quote Request";

export const SEND_QUOTE_REQUEST_DESCRIPTION =
  "Send your customer a link so they can tell you about the job and add photos before you call back or prepare the quote.";

export const primaryButtonClassName =
  "inline-flex min-h-12 items-center justify-center rounded-lg bg-[#2436BB] px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#1c2a96] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2";

export const secondaryButtonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2";

const shareOptionClassName =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 bg-white px-2 py-2 text-center text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2";

export async function copyText(text: string): Promise<boolean> {
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

export type QuoteLinkShareOutcome = "shared" | "cancelled" | "copied" | "unavailable";

/** Opens the device share sheet with the quote link, falling back to copying it. */
export async function shareQuoteLink(
  quoteUrl: string,
  businessName: string | null
): Promise<QuoteLinkShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: "Request a quote",
        text: buildQuoteLinkIntro(businessName),
        url: quoteUrl,
      });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(quoteUrl)) ? "copied" : "unavailable";
}

/**
 * Phone number, Send by Text, and the other share options for one quote-request link.
 * The phone number stays in component state and only ever goes into the on-device sms: link.
 */
export function SendQuoteRequestForm({
  quoteUrl,
  businessName,
  sourceLocation,
  layout,
  phoneInputRef,
}: {
  quoteUrl: string;
  businessName: string | null;
  sourceLocation: QuoteRequestShareSource;
  layout: "inline" | "sheet";
  phoneInputRef?: RefObject<HTMLInputElement | null>;
}) {
  const phoneInputId = useId();
  const phoneHelpId = useId();
  const phoneErrorId = useId();
  const otherWaysId = useId();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [textOpened, setTextOpened] = useState(false);
  const [status, setStatus] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const message = buildQuoteLinkMessage({ businessName, quoteUrl });
  const inline = layout === "inline";

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeCustomerMobileNumber(phone);
    if (!normalized) {
      setPhoneError("Enter the customer's phone number, e.g. 416-555-0123.");
      phoneInputRef?.current?.focus();
      return;
    }
    setPhoneError(null);
    setStatus("");
    setTextOpened(true);
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.text_clicked, sourceLocation);
    window.location.href = buildSmsHref(normalized, message);
  }

  async function handleCopyMessage() {
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.link_copied, sourceLocation, {
      copy_target: "message",
    });
    const ok = await copyText(message);
    setStatus(
      ok
        ? "Message copied. Paste it into a text to your customer."
        : `Couldn't copy automatically. Your link is ${quoteUrl}`
    );
  }

  async function handleCopy() {
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.link_copied, sourceLocation, {
      copy_target: "link",
    });
    const ok = await copyText(quoteUrl);
    setStatus(ok ? "Quote request link copied." : `Couldn't copy automatically. Your link is ${quoteUrl}`);
  }

  async function handleShare() {
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.native_share_clicked, sourceLocation, {
      share_method: typeof navigator.share === "function" ? "native" : "copy_fallback",
    });
    const outcome = await shareQuoteLink(quoteUrl, businessName);
    if (outcome === "shared" || outcome === "cancelled") {
      setStatus("");
    } else if (outcome === "copied") {
      setStatus("Sharing isn't available on this device, so the quote request link was copied instead.");
    } else {
      setStatus(`Sharing isn't available on this device. Your link is ${quoteUrl}`);
    }
  }

  function handleQr() {
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.qr_opened, sourceLocation);
    setQrOpen(true);
  }

  return (
    <>
      <form
        onSubmit={handleSend}
        noValidate
        className={`flex flex-col gap-3 ${inline ? "sm:flex-row sm:items-end" : ""}`}
      >
        <div className={`min-w-0 flex-1 ${inline ? "sm:max-w-xs" : ""}`}>
          <label htmlFor={phoneInputId} className="block text-sm font-medium text-zinc-800">
            Customer phone number
          </label>
          <input
            ref={phoneInputRef}
            id={phoneInputId}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            enterKeyHint="send"
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
        <button type="submit" className={`${primaryButtonClassName} ${inline ? "" : "w-full"}`}>
          Send by Text
        </button>
      </form>
      <p id={phoneHelpId} className="mt-2 text-xs text-zinc-500">
        Opens your phone&apos;s messages app with a short message and your quote request link ready
        to send.
      </p>
      {phoneError ? (
        <p id={phoneErrorId} role="alert" className="mt-1 text-sm text-red-700">
          {phoneError}
        </p>
      ) : null}
      {textOpened ? (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm text-zinc-700">
            Messages didn&apos;t open, or the text is missing? Copy the message and paste it into a
            text to your customer.
          </p>
          <button
            type="button"
            onClick={() => void handleCopyMessage()}
            className={`${secondaryButtonClassName} mt-2 w-full sm:w-auto`}
          >
            Copy Message
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <p id={otherWaysId} className="text-sm font-medium text-zinc-800">
          Other ways to share
        </p>
        <div
          role="group"
          aria-labelledby={otherWaysId}
          className={`mt-2 grid grid-cols-3 gap-2 ${inline ? "sm:flex sm:flex-wrap" : ""}`}
        >
          <button
            type="button"
            onClick={() => void handleCopy()}
            className={`${shareOptionClassName} ${inline ? "sm:px-4" : ""}`}
          >
            Copy Link
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className={`${shareOptionClassName} ${inline ? "sm:px-4" : ""}`}
          >
            Share
          </button>
          <button
            type="button"
            onClick={handleQr}
            className={`${shareOptionClassName} ${inline ? "sm:px-4" : ""}`}
          >
            QR Code
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 break-words text-sm text-zinc-700">
        {status}
      </p>
      <p className="mt-1 text-xs text-zinc-500">{QUOTE_LINK_WEBSITE_GUIDANCE}</p>
      <p className="mt-1 break-all text-xs font-medium text-zinc-700">{quoteUrl}</p>

      <QuoteQrDialog open={qrOpen} quoteUrl={quoteUrl} onClose={() => setQrOpen(false)} />
    </>
  );
}

/** Distance between the layout viewport bottom and the visible area (on-screen keyboard). */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = typeof window === "undefined" ? null : window.visualViewport;
    if (!active || !viewport) return;
    const update = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(Math.max(0, Math.round(covered)));
    };
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [active]);
  return active ? inset : 0;
}

/**
 * Button that opens Send Quote Request as a bottom sheet on phones and a centred dialog on
 * larger screens. Each opening starts with an empty phone number.
 */
export function SendQuoteRequestButton({
  quoteUrl,
  businessName,
  sourceLocation,
  className = primaryButtonClassName,
  children = SEND_QUOTE_REQUEST_LABEL,
}: {
  quoteUrl: string;
  businessName: string | null;
  sourceLocation: QuoteRequestShareSource;
  className?: string;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const keyboardInset = useKeyboardInset(open);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  function openSheet() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    // Focus inside the tap handler so mobile browsers raise the number keyboard straight away.
    phoneInputRef.current?.focus();
    setOpen(true);
    trackQuoteRequestShare(QUOTE_REQUEST_SHARE_EVENTS.share_opened, sourceLocation);
  }

  function closeSheet() {
    dialogRef.current?.close();
  }

  function handleDialogClose(event: React.SyntheticEvent<HTMLDialogElement>) {
    // React propagates `close` from the nested QR dialog; only react to the sheet itself.
    if (event.target !== event.currentTarget) return;
    setOpen(false);
    setSession((n) => n + 1);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={openSheet}
        className={className}
      >
        {children}
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={handleDialogClose}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSheet();
        }}
        style={
          keyboardInset > 0
            ? {
                marginBottom: keyboardInset,
                maxHeight: `calc(100dvh - 1rem - ${keyboardInset}px)`,
              }
            : undefined
        }
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[calc(100dvh-1rem)] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-zinc-900/50 sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[calc(100dvh-4rem)] sm:max-w-md sm:rounded-2xl"
      >
        <div className="sticky top-0 z-10 bg-white px-5 pt-2 sm:pt-5">
          <div aria-hidden="true" className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="pt-1.5 text-lg font-semibold text-zinc-900">
              {SEND_QUOTE_REQUEST_LABEL}
            </h2>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close Send Quote Request"
              className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB]"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <p id={descriptionId} className="text-sm text-zinc-600">
            {SEND_QUOTE_REQUEST_DESCRIPTION}
          </p>
          <div className="mt-4">
            <SendQuoteRequestForm
              key={session}
              quoteUrl={quoteUrl}
              businessName={businessName}
              sourceLocation={sourceLocation}
              layout="sheet"
              phoneInputRef={phoneInputRef}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}

function CloseIcon() {
  return (
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
  );
}

export function QuoteQrDialog({
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
          e.stopPropagation();
          onClose();
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
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
            <CloseIcon />
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
              {failed ? "Couldn't create the QR code. Use Copy Link instead." : "Creating QR code…"}
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
