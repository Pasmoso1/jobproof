/** Passthrough layout — auth is enforced per-route (status allows signed-out). */
export default function PartnerSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
