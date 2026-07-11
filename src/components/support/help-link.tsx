import Link from "next/link";

/**
 * Reusable contextual help link for future page placement.
 * Example: <HelpLink articleSlug="building-a-quote">Need help building a quote?</HelpLink>
 */
export function HelpLink({
  articleSlug,
  children,
  className,
}: {
  articleSlug: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/support/articles/${articleSlug}`}
      className={
        className ??
        "text-sm font-medium text-[#2436BB] underline-offset-2 hover:text-[#1c2a96] hover:underline"
      }
    >
      {children}
    </Link>
  );
}
