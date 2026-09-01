/**
 * Hand-rolled icon set — no icon package.
 * 24px grid, 1.7 stroke, inherits currentColor so one glyph serves the dark
 * rail and a white card alike.
 */

const PATHS = {
  dashboard: ['M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'],
  rules: ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M15 4v6M9 14v6'],
  layers: ['M12 3l9 5-9 5-9-5z', 'M3 13l9 5 9-5M3 17l9 5 9-5'],
  checklist: ['M9 6h12M9 12h12M9 18h12', 'M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17'],
  searchCheck: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4M8.5 11l2 2 4-4'],
  folder: ['M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z'],
  tag: ['M11.5 3H20a1 1 0 0 1 1 1v8.5a1 1 0 0 1-.29.7l-8 8a1 1 0 0 1-1.42 0l-8.5-8.5a1 1 0 0 1 0-1.42l8-8a1 1 0 0 1 .71-.28z', 'M16.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z'],
  inbox: ['M4 13l2-8h12l2 8v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', 'M4 13h4l1 2h6l1-2h4'],
  table: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M3 10h18M9 10v9M15 10v9'],
  upload: ['M12 16V4M7 9l5-5 5 5', 'M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2'],
  briefcase: ['M4 8h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18'],
  chart: ['M5 19V10M10 19V5M15 19v-6M20 19v-9'],
  pie: ['M12 3a9 9 0 1 0 9 9h-9z', 'M14 3.5A9 9 0 0 1 20.5 10H14z'],
  activity: ['M3 12h4l3 8 4-16 3 8h4'],
  spreadsheet: ['M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M4 9h16M4 15h16M10 9v12'],
  users: ['M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M2 20a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M18.5 20a6 6 0 0 0-2-4.5'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20a8 8 0 0 1 16 0'],
  userCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6.2 18.5a6.5 6.5 0 0 1 11.6 0'],
  code: ['M8 7l-5 5 5 5M16 7l5 5-5 5'],
  cog: ['M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', 'M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8'],
  sliders: ['M4 7h10M18 7h2M4 17h4M12 17h8', 'M15 4v6M9 14v6'],
  webhook: ['M9 12a3 3 0 1 1 5.2 2', 'M14 20a3 3 0 1 0-2.6-4.5M7 15a3 3 0 1 0 3 5M12 4a5 5 0 0 1 4.6 7M8 20h7'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.5.2-.7.6-.7 1.1v.5M12 17h.01'],
  shield: ['M12 3l8 3v6c0 4.5-3.2 7.9-8 9-4.8-1.1-8-4.5-8-9V6z'],
  archive: ['M3 6h18v3H3zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9', 'M10 13h4'],
  building: ['M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16', 'M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M2 21h20'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  filter: ['M3 5h18l-7 8v5l-4 2v-7z'],
  columns: ['M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z', 'M9.5 4v16M15 4v16'],
  copy: ['M9 9h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V10a1 1 0 0 1 1-1z', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  excel: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 12l6 6M15 12l-6 6'],
  csv: ['M6 3h8l4 4v14H6z', 'M14 3v4h4M9 13h6M9 17h4'],
  download: ['M12 4v12M7 11l5 5 5-5', 'M4 19v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1'],
  plus: ['M12 5v14M5 12h14'],
  close: ['M6 6l12 12M18 6L6 18'],
  check: ['M5 13l4 4L19 7'],
  trash: ['M4 7h16M10 11v6M14 11v6', 'M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3'],
  edit: ['M4 20h4L20 8l-4-4L4 16z', 'M14 6l4 4'],
  power: ['M12 4v8', 'M17.7 7.3a8 8 0 1 1-11.4 0'],
  branch: ['M6 4v10a3 3 0 0 0 3 3h6', 'M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  history: ['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4M12 7v5l3 2'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3 2'],
  calendar: ['M4 6h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M3 10h18M8 4v4M16 4v4'],
  alert: ['M12 4l9 16H3z', 'M12 10v4M12 17h.01'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5M12 8h.01'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  image: ['M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M4 16l4.5-4.5 3 3L15 11l5 5M8.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
  grid: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  single: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z'],
  zoomIn: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4M11 8v6M8 11h6'],
  zoomOut: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4M8 11h6'],
  bell: ['M18 15V10a6 6 0 0 0-12 0v5l-2 3h16z', 'M10 21h4'],
  logout: ['M9 20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4', 'M16 16l4-4-4-4M20 12H9'],
  chevron: ['M9 6l6 6-6 6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronsLeft: ['M11 6l-6 6 6 6M18 6l-6 6 6 6'],
  chevronsRight: ['M13 6l6 6-6 6M6 6l6 6-6 6'],
  chevronsUpDown: ['M8 9l4-4 4 4M8 15l4 4 4-4'],
  arrowUp: ['M12 19V5M6 11l6-6 6 6'],
  arrowDown: ['M12 5v14M6 13l6 6 6-6'],
  arrowLeft: ['M19 12H5M11 6l-6 6 6 6'],
  drag: ['M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01'],
  refresh: ['M20 12a8 8 0 1 1-2.3-5.6', 'M20 4v4h-4'],
  play: ['M8 5l11 7-11 7z'],
  send: ['M21 3L3 10l7 3 3 7z'],
  link: ['M10 14a4 4 0 0 1 0-5.7l2.6-2.6a4 4 0 0 1 5.7 5.7L17 12.7', 'M14 10a4 4 0 0 1 0 5.7l-2.6 2.6a4 4 0 0 1-5.7-5.7L7 11.3'],
  external: ['M14 4h6v6', 'M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5'],
  lock: ['M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  card: ['M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z', 'M2 10h20M6 14h3'],
  wrench: ['M14.5 5.5a4.5 4.5 0 0 0 5.9 5.9L21 12l-8 8a2.8 2.8 0 0 1-4-4l8-8z'],
  pause: ['M9 5v14M15 5v14'],
  route: ['M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4', 'M18 8v3a3 3 0 0 1-3 3H9a3 3 0 0 0-3 3v1'],
  referral: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4 20a8 8 0 0 1 12-6.9M17 17h6M20 14v6'],
  resubmit: ['M4 12a8 8 0 0 1 13.7-5.6', 'M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5'],
  message: ['M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z'],
};

export function Icon({ name, size = 16, strokeWidth = 1.7, className = '', title, style, ...rest }) {
  const paths = PATHS[name];
  if (!paths) return null;

  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ flex: 'none', ...style }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export default Icon;
