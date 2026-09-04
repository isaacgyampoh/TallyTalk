// The doodle wallpaper behind a task thread. One tiling SVG pattern of line-art
// glyphs drawn from the things people put on lists — calls, meetings, files,
// travel, errands. Stroked in `currentColor` so it takes the theme's thread ink.

// Each glyph is drawn inside a 24x24 box.
const GLYPHS = [
  'M12 3.2l2.6 5.5 6 .9-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.9z', // star
  'M12 20.2s-7-4.7-7-9.4A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.8c0 4.7-7 9.4-7 9.4z', // heart
  'M5 5h14v14H5zM8.6 12l2.4 2.4L16 9', // ticked box
  'M12 5.4a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2zM12 8.4V12l2.5 1.7', // clock
  'M7 3h10v18H7zM10.4 18.4h3.2', // phone
  'M4 8h4l1.6-2h4.8L16 8h4v11H4zM12 17.1a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z', // camera
  'M3 6h18v12H3zM3 6.8l9 6.6 9-6.6', // envelope
  'M12 3a5.5 5.5 0 0 1 3.4 9.8V16H8.6v-3.2A5.5 5.5 0 0 1 12 3zM9.6 19h4.8M10.2 21.4h3.6', // bulb
  'M12 3a5 5 0 0 1 5 5v4.2l1.8 2.9H5.2L7 12.2V8a5 5 0 0 1 5-5zM10.1 18.4a2 2 0 0 0 3.8 0', // bell
  'M3 6h6l2 2.6h10V19H3z', // folder
  'M16 9l-5.6 5.6a2.5 2.5 0 0 0 3.6 3.5L20.2 12A4.6 4.6 0 0 0 13.7 5.5L7 12.3', // clip
  'M4 6h16v14H4zM4 10.4h16M9 4v4.2M15 4v4.2', // calendar
  'M7 3h10M7 21h10M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9', // hourglass
  'M4 5h16v10.4H9.2L4 19.4z', // chat
  'M11 4.6a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.8 15.8L21 21', // magnifier
  'M8 4h8v5a4 4 0 0 1-8 0zM8 5.6H5.5V8a3 3 0 0 0 3 3M16 5.6h2.5V8a3 3 0 0 1-3 3M10 17.2h4M9 20.6h6', // trophy
  'M3 12.6L21 5l-6.6 16-3-6zM11.4 15L21 5', // plane
  'M5 7h12v7a5 5 0 0 1-10 0zM17 8.6h2.2a2.2 2.2 0 0 1 0 4.4H17M4 20.2h14', // cup
  'M4 20l1-4L16.6 4.4a2.1 2.1 0 0 1 3 3L8 19zM14.4 6.6l3 3', // pencil
  'M6 3v18M6 4.6h11l-2 3.5 2 3.5H6z', // flag
  'M9 18V6.6l9-2V16M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM18 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z', // note
  'M3 9h18v3H3zM4.6 12v8h14.8v-8M12 9v11M8.6 9a2.2 2.2 0 1 1 1.6-3.7L12 9M15.4 9a2.2 2.2 0 1 0-1.6-3.7L12 9', // parcel
] as const

// [glyph, x, y, scale, rotation] — irregular on purpose so the tile edge hides.
const TILE: [number, number, number, number, number][] = [
  [0, 18, 24, 1.15, -14],
  [4, 108, 12, 0.95, 9],
  [13, 178, 40, 1.2, -6],
  [6, 262, 16, 1.0, 12],
  [15, 326, 46, 1.05, -10],
  [9, 60, 96, 1.1, 7],
  [3, 142, 110, 1.0, -18],
  [17, 224, 92, 1.15, 5],
  [20, 300, 122, 0.95, -8],
  [1, 24, 168, 1.05, 14],
  [11, 106, 190, 1.1, -5],
  [7, 190, 172, 1.0, 10],
  [5, 268, 196, 1.15, -12],
  [12, 340, 178, 0.9, 6],
  [21, 40, 250, 1.05, -9],
  [14, 130, 268, 1.1, 11],
  [2, 214, 252, 1.0, -15],
  [18, 292, 276, 1.05, 8],
  [10, 16, 322, 1.0, 12],
  [16, 96, 336, 1.1, -7],
  [19, 178, 320, 0.95, 15],
  [8, 252, 338, 1.05, -11],
  [3, 328, 312, 1.0, 9],
]

/**
 * Fills its positioned parent. Decorative only — hidden from assistive tech.
 */
export function TaskWallpaper() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-thread-ink"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="tt-doodles" width="360" height="360" patternUnits="userSpaceOnUse">
          {TILE.map(([g, x, y, s, r], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
              <path
                d={GLYPHS[g]}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#tt-doodles)" />
    </svg>
  )
}
