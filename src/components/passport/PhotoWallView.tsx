import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, User } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { formatFullRoom } from '@/lib/utils';
import { getParticipantThumb } from '@/lib/participantImage';
import { hapticImpact } from '@/lib/capacitorHaptics';

type Cabin = Tables<'cabins'>;

interface WallParticipant {
  id: string;
  name: string;
  room: string | null;
  image_url: string | null;
  image_thumb_url?: string | null;
  image_aged_url?: string | null;
  has_arrived: boolean | null;
  cabins: Cabin | null;
}

interface PhotoWallViewProps {
  cabinGroups: { cabin: Cabin; participants: WallParticipant[]; leaders: { id: string; name: string }[] }[];
  onParticipantClick: (id: string) => void;
  onPrefetchParticipant?: (id: string) => void;
  showAged?: boolean;
}

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

const PhotoTile = memo(
  ({
    p,
    onClick,
    onPrefetch,
    showAged,
  }: {
    p: WallParticipant;
    onClick: () => void;
    onPrefetch?: () => void;
    showAged?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => {
        hapticImpact('light');
        onClick();
      }}
      onMouseEnter={onPrefetch}
      onTouchStart={onPrefetch}
      className="ios-surface group flex flex-col items-center gap-1.5 rounded-2xl p-2 text-center transition-transform active:scale-[0.96]"
    >
      <div className="relative">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shadow-sm">
          <AvatarImage
            src={(showAged && p.image_aged_url ? p.image_aged_url : getParticipantThumb(p)) ?? undefined}
            alt={p.name}
            loading="lazy"
          />
          <AvatarFallback className="bg-muted text-sm font-semibold">
            {p.name ? initials(p.name) : <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
        {p.has_arrived && (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </span>
        )}
      </div>
      <span className="w-full truncate text-[11px] font-medium leading-tight text-foreground">
        {p.name}
      </span>
    </button>
  )
);
PhotoTile.displayName = 'PhotoTile';

export const PhotoWallView = ({
  cabinGroups,
  onParticipantClick,
  onPrefetchParticipant,
  showAged,
}: PhotoWallViewProps) => {
  if (cabinGroups.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Ingen deltakere å vise.</p>
    );
  }

  return (
    <div className="space-y-6">
      {cabinGroups.map(({ cabin, participants }) => {
        const rooms: { key: string; name: string; list: WallParticipant[] }[] = [
          {
            key: 'høyre',
            name: formatFullRoom(cabin.name, 'høyre') || 'Høyre',
            list: participants.filter((p) => p.room === 'høyre'),
          },
          {
            key: 'venstre',
            name: formatFullRoom(cabin.name, 'venstre') || 'Venstre',
            list: participants.filter((p) => p.room === 'venstre'),
          },
          {
            key: 'none',
            name: 'Uten rom',
            list: participants.filter((p) => p.room !== 'høyre' && p.room !== 'venstre'),
          },
        ].filter((r) => r.list.length > 0);

        return (
          <section key={cabin.id} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold text-foreground">{cabin.name}</h2>
              <span className="text-xs text-muted-foreground">
                {participants.length} deltakere
              </span>
            </div>

            {rooms.map((room) => (
              <div key={room.key} className="rounded-2xl border bg-card/60 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {room.name} ({room.list.length})
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                  {[...room.list]
                    .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
                    .map((p) => (
                      <PhotoTile
                        key={p.id}
                        p={p}
                        showAged={showAged}
                        onClick={() => onParticipantClick(p.id)}
                        onPrefetch={
                          onPrefetchParticipant ? () => onPrefetchParticipant(p.id) : undefined
                        }
                      />
                    ))}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
};
