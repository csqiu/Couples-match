import { cn } from '@/lib/cn';

const SIZE = { sm: 'h-[22px] w-[22px] text-[10px]', md: 'h-7 w-7 text-xs', lg: 'h-10 w-10 text-sm' } as const;

/** A partner's initial in their color: sage for partner 1, plum for partner 2. */
export function Avatar({ name, slot, size = 'md', className }: { name: string; slot: 1 | 2; size?: keyof typeof SIZE; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-partner-fg',
        slot === 1 ? 'bg-partner-1' : 'bg-partner-2',
        SIZE[size],
        className,
      )}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

/** Two overlapping avatars, the second with a ring in the surface color. */
export function AvatarPair({ names, size = 'md' }: { names: [string, string]; size?: keyof typeof SIZE }) {
  return (
    <span className="inline-flex items-center">
      <Avatar name={names[0]} slot={1} size={size} />
      <Avatar name={names[1]} slot={2} size={size} className="-ml-2 ring-2 ring-surface" />
    </span>
  );
}
