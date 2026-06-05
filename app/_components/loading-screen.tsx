import Image from 'next/image'

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Logo + spinning ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer spinning ring */}
        <div
          className="absolute rounded-full border-2 border-transparent animate-spin"
          style={{
            width: 88,
            height: 88,
            borderTopColor: 'hsl(var(--primary))',
            borderRightColor: 'hsl(var(--primary) / 0.3)',
            animationDuration: '0.9s',
          }}
        />
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-sm">
          <Image
            src="/cortex-icon.svg"
            alt="Cortex"
            width={64}
            height={64}
            priority
          />
        </div>
      </div>

      {/* Wordmark */}
      <p className="mt-5 text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase select-none">
        Cortex
      </p>
    </div>
  )
}
