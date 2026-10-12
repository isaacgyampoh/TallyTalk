import wallpaper from '@/assets/task-wallpaper.webp'

/**
 * The doodle wallpaper behind a task thread.
 *
 * This replaces a hand-drawn SVG pattern of ~22 glyphs with the designed
 * artwork. It tiles: opposite edges differ by under 9 of 255, and the doodles
 * themselves only carry about 17 levels of contrast against the paper, so a
 * seam is not perceptible.
 *
 * Dark mode inverts rather than shipping a second asset. The source is close to
 * monochrome — warm off-white paper, grey ink — so inverting gives dark paper
 * with light ink, which is exactly the dark palette. A second image would be
 * another 64 KB over a mobile connection for no visual gain.
 *
 * Decorative, so hidden from assistive technology.
 */
export function TaskWallpaper() {
  return (
    <div
      aria-hidden="true"
      className="task-wallpaper pointer-events-none absolute inset-0"
      style={{ backgroundImage: `url(${wallpaper})` }}
    />
  )
}
