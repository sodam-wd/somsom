// workshop-ui 소유: 인라인 SVG 아이콘 (스티치 선 느낌의 둥근 선).
const PATHS = {
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3',
  prev: 'M15 18 9 12l6-6',
  next: 'm9 18 6-6-6-6',
  flip: 'M12 3v18M8 7 3 12l5 5V7ZM16 7l5 5-5 5V7Z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'm6 14 6-6 6 6',
  down: 'm6 10 6 6 6-6',
  top: 'M6 6h12M6 16l6-6 6 6',
  bottom: 'M6 18h12M6 8l6 6 6-6',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  play: 'M8 5v14l11-7Z',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  shake: 'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM8 21h8M3 8l2 2M21 8l-2 2M3 13l2-1M21 13l-2-1',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  photo: 'M4 5h16v14H4zM8 10a2 2 0 1 0 0-.01M20 15l-5-5-9 9',
  palette: 'M12 3a9 9 0 1 0 0 18c1 0 2-1 1-2.5S13 15 15 15h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8ZM7.5 11h.01M10 7h.01M15 7h.01',
  reset: 'M4 4v6h6M4.5 15a8 8 0 1 0 1.5-8.5L4 10',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  close: 'M6 6l12 12M18 6 6 18',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  plus: 'M12 5v14M5 12h14',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  layers: 'm12 3 9 5-9 5-9-5ZM3 13l9 5 9-5',
  snow: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2',
  check: 'm5 12 5 5 9-10',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
