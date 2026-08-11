import { useQuery } from '@tanstack/react-query';
import { Phone, MessageSquare, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { LederPass } from '@/components/passport/LederPass';
import { SnusCanRotator, snusProductsFrom } from '@/components/snus/SnusCanRotator';
import { snusFullName } from '@/lib/snusCatalog';

interface OffSeasonLeaderSheetProps {
  leaderId: string | null;
  onOpenChange: (open: boolean) => void;
}

/** Off season-detaljvisning: fullt lederpass + snusboks + kontakt. */
export function OffSeasonLeaderSheet({ leaderId, onOpenChange }: OffSeasonLeaderSheetProps) {
  const { data: leader, isLoading } = useQuery({
    queryKey: ['offseason-leader-detail', leaderId],
    enabled: !!leaderId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leaders')
        .select('*')
        .eq('id', leaderId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cans = snusProductsFrom(
    leader?.snus_user
      ? (leader as any)?.snus_product_ids?.length
        ? (leader as any).snus_product_ids
        : [(leader as any)?.snus_product_id]
      : [],
    leader?.snus_user ? (leader as any)?.snus_custom_label : null,
  );

  return (
    <Sheet open={!!leaderId} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[92dvh] rounded-t-[28px] p-0"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-heading font-bold text-foreground">
                {leader?.name ?? 'Leder'}
              </h2>
              {cans.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">
                  {cans.map((c) => snusFullName(c)).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {leader?.phone && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    aria-label="Ring"
                    onClick={() => (window.location.href = `tel:${leader.phone}`)}
                  >
                    <Phone className="h-5 w-5 text-green-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full"
                    aria-label="Send SMS"
                    onClick={() => (window.location.href = `sms:${leader.phone}`)}
                  >
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </Button>
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full"
                aria-label="Lukk"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {cans.length > 0 && (
            <div className="flex justify-center pb-1">
              <SnusCanRotator
                productIds={
                  (leader as any)?.snus_product_ids?.length
                    ? (leader as any).snus_product_ids
                    : [(leader as any)?.snus_product_id]
                }
                customLabel={(leader as any)?.snus_custom_label}
                size={104}
                interactive
              />
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            {isLoading ? (
              <Skeleton className="mx-5 h-full rounded-2xl" />
            ) : (
              <LederPass leader={leader as any} fill />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
