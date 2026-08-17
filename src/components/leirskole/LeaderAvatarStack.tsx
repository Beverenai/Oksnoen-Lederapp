import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export type AvatarPerson = {
  id: string;
  name: string;
  imageUrl?: string | null;
};

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/**
 * Avatarrekke for ledere på en vakt. Viser navn under bildet når `withNames`
 * er satt, ellers kompakt stack med «+N» for de som ikke får plass.
 */
export function LeaderAvatarStack({
  people,
  max = 6,
  size = 'md',
  withNames = false,
  onSelect,
  emptyLabel = 'Ingen satt opp',
}: {
  people: AvatarPerson[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  withNames?: boolean;
  onSelect?: (person: AvatarPerson) => void;
  emptyLabel?: string;
}) {
  const dim = size === 'sm' ? 'h-7 w-7' : size === 'lg' ? 'h-12 w-12' : 'h-9 w-9';
  const text = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-xs' : 'text-[10px]';

  if (people.length === 0) {
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  }

  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  if (withNames) {
    return (
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={onSelect ? () => onSelect(person) : undefined}
            className="flex w-16 flex-col items-center gap-1 rounded-2xl p-1 transition-transform active:scale-95"
          >
            <Avatar className={`${dim} ring-2 ring-background`}>
              <AvatarImage src={person.imageUrl ?? undefined} alt={person.name} />
              <AvatarFallback className={text}>{initials(person.name)}</AvatarFallback>
            </Avatar>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {person.name.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {shown.map((person, index) => (
        <button
          key={person.id}
          type="button"
          title={person.name}
          onClick={onSelect ? () => onSelect(person) : undefined}
          className={`${index > 0 ? '-ml-2' : ''} rounded-full transition-transform hover:z-10 hover:scale-110 active:scale-95`}
        >
          <Avatar className={`${dim} ring-2 ring-background`}>
            <AvatarImage src={person.imageUrl ?? undefined} alt={person.name} />
            <AvatarFallback className={text}>{initials(person.name)}</AvatarFallback>
          </Avatar>
        </button>
      ))}
      {rest > 0 && (
        <span
          className={`-ml-2 flex ${dim} items-center justify-center rounded-full bg-muted ${text} font-semibold ring-2 ring-background`}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}