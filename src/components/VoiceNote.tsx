import { useEffect, useRef, useState } from 'react'
import { PlayIcon, PauseIcon } from './icons'

// A stable pseudo-waveform so bars don't reshuffle on re-render.
const BARS = [5, 9, 14, 8, 17, 11, 20, 13, 7, 16, 10, 19, 12, 6, 15, 9, 18, 8, 13, 5, 11, 16]

export function VoiceNote({ duration, mine }: { duration: number; mine: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const ref = useRef<number | null>(null)

  useEffect(() => {
    if (!playing) return
    ref.current = window.setInterval(() => {
      setT((prev) => {
        if (prev + 0.1 >= duration) {
          setPlaying(false)
          return 0
        }
        return prev + 0.1
      })
    }, 100)
    return () => {
      if (ref.current) window.clearInterval(ref.current)
    }
  }, [playing, duration])

  const progress = t / duration
  const barActive = mine ? 'bg-white' : 'bg-violet'
  const barIdle = mine ? 'bg-white/35' : 'bg-violet/25'
  const fmt = (s: number) => `0:${String(Math.max(0, Math.ceil(duration - s))).padStart(2, '0')}`

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setPlaying((p) => !p)}
        className={`press grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          mine ? 'bg-white text-violet' : 'bg-violet text-white'
        }`}
        aria-label={playing ? 'Pause' : 'Play voice note'}
      >
        {playing ? <PauseIcon width={16} height={16} /> : <PlayIcon width={16} height={16} />}
      </button>
      <div className="flex h-8 items-center gap-[3px]">
        {BARS.map((h, i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i / BARS.length <= progress ? barActive : barIdle}`}
            style={{ height: h }}
          />
        ))}
      </div>
      <span className={`nums text-[12px] font-semibold ${mine ? 'text-white/90' : 'text-ink-soft'}`}>
        {fmt(t)}
      </span>
    </div>
  )
}
