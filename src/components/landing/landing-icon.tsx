const PATHS = {
  inbox: "M3 13h4l2 3h6l2-3h4 M5 5h14l2 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z",
  clipboard:
    "M9 3h6v3H9z M8 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-2 M9 12l2 2 4-4",
  home: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5",
  document: "M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6",
  send: "M4 12l16-8-6 16-3-7z M11 13l9-9",
  pen: "M4 20h4l10-10-4-4L4 16z M13 7l4 4",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M8 12l3 3 5-6",
  trophy:
    "M8 4h8v5a4 4 0 0 1-8 0z M8 6H5a3 3 0 0 0 3 4 M16 6h3a3 3 0 0 1-3 4 M12 13v4 M9 20h6",
  message: "M4 5h16v11H9l-5 4z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2",
  users:
    "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M3 20a6 6 0 0 1 12 0 M16 5.2a3 3 0 0 1 0 5.6 M21 20a6 6 0 0 0-4-5.6",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z M9 12l2 2 4-4",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2z M9 8h6 M9 12h6",
  camera: "M4 8h3l2-3h6l2 3h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  swap: "M7 7h13 M16 3l4 4-4 4 M17 17H4 M8 13l-4 4 4 4",
  folder: "M3 6h6l2 2h10v11H3z",
} as const;

export type LandingIconName = keyof typeof PATHS;

export function LandingIcon({
  name,
  className = "h-5 w-5",
}: {
  name: LandingIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
