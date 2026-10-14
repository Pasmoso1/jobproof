import type { Metadata } from "next";
import { SampleQuoteView } from "./sample-quote-view";

export const metadata: Metadata = {
  title: "Sample Customer Quote | JobProof",
  description:
    "See the kind of professional quote a customer receives from a contractor using JobProof. This is a sample; the business, customer and prices are fictional.",
  robots: { index: false, follow: true },
};

export default async function SampleQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  return <SampleQuoteView fromDashboard={from === "dashboard"} />;
}
