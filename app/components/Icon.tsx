const PATHS: Record<string, React.ReactNode> = {
  today: <><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></>,
  dumbbell: <><path d="M6 5v14M18 5v14M2 9v6M22 9v6M6 12h12" /></>,
  history: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  progress: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></>,
  routines: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  builder: <><path d="M12 2l2.4 4.9L20 8l-4 3.9.9 5.6L12 15l-4.9 2.5.9-5.6L4 8l5.6-1.1z" /></>,
  exercises: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  body: <><circle cx="12" cy="5" r="2.5" /><path d="M12 8v7M8 11h8M9 22l3-7 3 7" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  admin: <><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <><path d="M5 12l5 5L20 7" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  more: <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>,
  note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  up: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
  run: <><circle cx="14" cy="4" r="2" /><path d="M6 21l3-6 3 2v5M8 11l3-4 4 2 2 4h3M11 7l-2 5" /></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></>,
  swap: <><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></>,
  play: <><path d="M7 4l13 8-13 8z" /></>,
  pause: <><path d="M7 4h4v16H7zM13 4h4v16h-4z" /></>,
  chevron: <><path d="M9 6l6 6-6 6" /></>,
  back: <><path d="M15 6l-6 6 6 6" /></>,
  gps: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
  upload: <><path d="M12 21V9M7 14l5-5 5 5M4 3h16" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0" /></>,
};

export default function Icon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[name] ?? null}
    </svg>
  );
}
