"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { JobProofLogo } from "@/components/jobproof-logo";
import { LogoutButton } from "@/app/(app)/logout-button";
import { getAppNavLinks, isAppNavLinkActive } from "@/lib/app-nav";

const menuItemClassName =
  "flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-base font-medium text-zinc-800 transition-colors hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB]";

export function AppMobileNav({
  showPartnerPortal,
  newQuoteRequestCount,
  feedbackHref,
}: {
  showPartnerPortal: boolean;
  newQuoteRequestCount: number;
  feedbackHref: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";
  const [lastPathname, setLastPathname] = useState(pathname);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const links = getAppNavLinks({ showPartnerPortal });

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
    if (!open && dialog.open) {
      dialog.close();
      menuButtonRef.current?.focus();
    }
    if (!open) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  function handleDialogClose() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

  const badgeLabel =
    newQuoteRequestCount > 0 ? `${newQuoteRequestCount} new quote requests` : null;

  return (
    <>
      <button
        ref={menuButtonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(true)}
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
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
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
        <span>Menu</span>
        {badgeLabel ? (
          <>
            <span
              aria-hidden="true"
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-600"
            />
            <span className="sr-only">({badgeLabel})</span>
          </>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        id={menuId}
        aria-label="Main menu"
        onClose={handleDialogClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
          }
        }}
        className="m-0 h-full max-h-none w-full max-w-none bg-white p-0 text-zinc-900 backdrop:bg-zinc-900/40"
      >
        <div className="flex min-h-full flex-col pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-zinc-200 px-4">
            <Link href="/dashboard" onClick={closeMenu} className="flex items-center">
              <JobProofLogo className="h-8 w-auto" />
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              aria-label="Close menu"
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2436BB] focus-visible:ring-offset-2"
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
              <span>Close</span>
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">
              {links.map((link) => {
                const active = isAppNavLinkActive(pathname, link.href);
                return (
                  <li key={link.key}>
                    <Link
                      href={link.href}
                      onClick={closeMenu}
                      aria-current={active ? "page" : undefined}
                      className={`${menuItemClassName} ${active ? "bg-zinc-100 text-zinc-900" : ""}`}
                    >
                      <span>{link.label}</span>
                      {link.key === "quote-requests" && newQuoteRequestCount > 0 ? (
                        <span
                          className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-semibold leading-none text-white"
                          aria-label={badgeLabel ?? undefined}
                        >
                          {newQuoteRequestCount > 99 ? "99+" : newQuoteRequestCount}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3">
              <a href={feedbackHref} onClick={closeMenu} className={menuItemClassName}>
                Send feedback
              </a>
              <LogoutButton className={menuItemClassName} />
            </div>
          </nav>
        </div>
      </dialog>
    </>
  );
}
