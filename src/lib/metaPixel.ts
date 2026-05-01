type Fbq = (action: "init" | "track", idOrEvent: string, data?: Record<string, unknown>) => void;

function getFbq(): Fbq | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { fbq?: Fbq }).fbq;
}

export const trackEvent = (eventName: string, options: Record<string, unknown> = {}) => {
  const fbq = getFbq();
  if (fbq) {
    fbq("track", eventName, options);
  }
};
