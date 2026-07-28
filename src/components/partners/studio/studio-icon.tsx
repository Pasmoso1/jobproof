/** Lightweight inline icons for Marketing Studio selection cards. */

const PATHS: Record<string, string> = {
  briefcase: "M4 7h16v12H4V7zm4-3h8v3H8V4z",
  document: "M7 3h7l5 5v13H7V3zm7 1.5V9h4.5",
  inbox: "M3 6h18v12H3V6zm0 7h18",
  contract: "M6 3h9l3 3v15H6V3zm3 8h6M9 12h6M9 15h4",
  refresh: "M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M16 4v4h4M8 20v-4H4",
  invoice: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zm3 5h6M9 10h6M9 13h4",
  bolt: "M13 2 4 14h7l-1 8 10-14h-7l1-6z",
  camera: "M4 8h4l2-2h4l2 2h4v11H4V8zm8 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z",
  folder: "M3 7h6l2 2h10v10H3V7z",
  shield: "M12 3 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3z",
  grid: "M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z",
  hardhat: "M4 14h16v3H4v-3zm2-2a6 6 0 0 1 12 0",
  home: "M4 11 12 4l8 7v9H4v-9zm5 9v-5h6v5",
  temp: "M10 14.5V6a2 2 0 1 1 4 0v8.5a3.5 3.5 0 1 1-4 0z",
  zap: "M13 2 4 14h7l-1 8 10-14h-7l1-6z",
  droplet: "M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11z",
  brush: "M6 16l4 4 10-10-4-4L6 16zm1 5H4v-3",
  leaf: "M5 19c8-1 12-8 14-14-6 2-12 5-14 14zm0 0c2-4 6-7 10-9",
  hammer: "M14 4l6 6-3 3-6-6 3-3zM10 10 4 20l2 2 10-10",
  layers: "M12 4 3 9l9 5 9-5-9-5zm-9 8 9 5 9-5M3 16l9 5 9-5",
  block: "M4 8h16v10H4V8zm2-3h12v3H6V5z",
  building: "M5 21V5h8v16H5zm10-10h4v10h-4V11zM8 8h2M8 11h2M8 14h2",
  users: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7 1a2.5 2.5 0 1 0 0-5M3 20v-1a5 5 0 0 1 10 0v1M15 20v-1a4 4 0 0 1 6 0",
  crane: "M4 20h16M7 20V8h3l7-4v4H10v12",
  link: "M9 12h6M8 8h2a4 4 0 0 1 0 8H8M16 8h-2a4 4 0 0 0 0 8h2",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4z",
  gift: "M4 10h16v10H4V10zm8-6a3 3 0 0 0-3 3h6a3 3 0 0 0-3-3zm0 6v10M4 10h16",
  star: "M12 3l2.5 6.5L21 11l-5 4.5L17.5 22 12 18.5 6.5 22 8 15.5 3 11l6.5-1.5L12 3z",
  flag: "M5 3v18M5 4h12l-2 4 2 4H5",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  mail: "M3 6h18v12H3V6zm0 0 9 7 9-7",
  share: "M16 6a3 3 0 1 0 0-6M8 12a3 3 0 1 0 0-6M16 18a3 3 0 1 0 0-6M10.5 10.5l3-2M10.5 13.5l3 2",
  facebook: "M14 9h3V6h-3c-2 0-3 1-3 3v2H9v3h2v7h3v-7h3l1-3h-4V9z",
  instagram: "M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zm4 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5-2h.01",
  story: "M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  linkedin: "M6 9v10M6 5v.01M10 19v-7a3 3 0 0 1 6 0v7M10 12h.01",
  x: "M4 4l16 16M20 4 4 20",
  image: "M4 6h16v12H4V6zm3 9 3-4 3 3 2-2 3 3",
  card: "M7 4h10v16H7V4zm2 4h6M9 12h6M9 16h4",
  flyer: "M6 3h9l3 3v15H6V3z",
  poster: "M5 3h14v18H5V3zm3 4h8M8 11h8M8 15h5",
  check: "M5 12l4 4L19 6",
  spark: "M12 3v4M12 17v4M4 12h4M16 12h4M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3",
  smile: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 10h.01M16 10h.01M8 14c1.5 2 6.5 2 8 0",
  minus: "M5 12h14",
};

export function StudioIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const d = PATHS[name] ?? PATHS.check;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
