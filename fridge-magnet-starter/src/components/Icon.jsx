// Every icon in the app, drawn here as lines rather than borrowed from
// the emoji keyboard. Emoji look different on every phone, cannot take
// the app's colours, and are the quickest way to make an app look
// unfinished — these are one consistent set instead.
//
// Each icon is drawn on a 24x24 grid and inherits the colour and size of
// whatever it sits inside, so <Icon name="scan" /> inside a green button
// comes out green.

const paths = {
  // The four tabs
  list: (
    <>
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h12" />
      <path d="m3 6 1.5 1.5L7 5" />
      <path d="m3 12 1.5 1.5L7 11" />
      <path d="M3.5 18h1" />
    </>
  ),
  fridge: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 10h14" />
      <path d="M8.5 6v2" />
      <path d="M8.5 13v3" />
    </>
  ),
  recipes: (
    <>
      <path d="M5 10h14v6.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V10Z" />
      <path d="M3.5 10h17" />
      <path d="M9 6.5c0-1.4 1.3-2.5 3-2.5s3 1.1 3 2.5" />
      <path d="M12 4V2.6" />
    </>
  ),
  scan: (
    <>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" />
      <path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" />
      <path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" />
      <path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <path d="M7 8v8" />
      <path d="M10.5 8v8" />
      <path d="M14 8v8" />
      <path d="M17 8v8" />
    </>
  ),

  // The app's own mark: the horseshoe magnet from the home screen icon
  magnet: (
    <>
      <path d="M6 3.5v9.5a6 6 0 0 0 12 0V3.5" />
      <path d="M6 9.5h4.5" />
      <path d="M13.5 9.5H18" />
    </>
  ),

  // Actions
  back: <path d="m14.5 5-7 7 7 7" />,
  forward: <path d="m9.5 5 7 7-7 7" />,
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  edit: (
    <>
      <path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
    </>
  ),
  up: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  down: <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
  settings: (
    <>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <path d="M4 17h8" />
      <path d="M16 17h4" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>
  ),
  signOut: (
    <>
      <path d="M14.5 8V5.5A1.5 1.5 0 0 0 13 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h7a1.5 1.5 0 0 0 1.5-1.5V16" />
      <path d="M9.5 12h11m0 0-3-3m3 3-3 3" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
    </>
  ),

  // States and meanings
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21 19H3l9-15.5Z" />
      <path d="M12 9.5v4" />
      <path d="M12 16.5h.01" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" />
      <path d="M10 18.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  basket: (
    <>
      <path d="M4 9h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9Z" />
      <path d="m8.5 9 2-5" />
      <path d="m15.5 9-2-5" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" />
      <path d="M3.5 7.5 12 11.5l8.5-4" />
      <path d="M12 11.5v9" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" />
      <path d="M9.5 20.5V14h5v6.5" />
    </>
  ),
  install: (
    <>
      <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" />
      <path d="M4.5 16v2.5A2 2 0 0 0 6.5 20.5h11a2 2 0 0 0 2-2V16" />
    </>
  ),
  share: (
    <>
      <path d="M12 15V4m0 0-3.5 3.5M12 4l3.5 3.5" />
      <path d="M6 11H5a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 19 11h-1" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
    </>
  ),
}

export default function Icon({ name, size = 20, className, ...rest }) {
  const drawing = paths[name]
  if (!drawing) return null

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {drawing}
    </svg>
  )
}
