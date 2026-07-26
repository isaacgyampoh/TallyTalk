interface AvatarProps {
  initials: string
  color: string
  size?: number
}

export function Avatar({ initials, color, size = 46 }: AvatarProps) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-display font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials.slice(0, 2)}
    </div>
  )
}
