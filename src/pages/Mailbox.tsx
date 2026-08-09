import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MailboxIllustration } from '@/components/mailbox/MailboxIllustration';
import { NewMessageSheet } from '@/components/mailbox/NewMessageSheet';
import { MyMessagesList } from '@/components/mailbox/MyMessagesList';
import { AdminInbox } from '@/components/mailbox/AdminInbox';
import {
  useAllMailboxMessages,
  useMailboxRealtime,
  useMyMailboxMessages,
} from '@/hooks/useMailbox';
import { Mail } from 'lucide-react';

export default function Mailbox() {
  const { isAdmin } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flapOpen, setFlapOpen] = useState(false);
  useMailboxRealtime();

  const mine = useMyMailboxMessages();
  const all = useAllMailboxMessages(!!isAdmin);
  const newCount = (all.data ?? []).filter((m) => m.status === 'new').length;

  const composer = (
    <div className="space-y-4">
      <MailboxIllustration open={flapOpen || sheetOpen} />
      <p className="text-center text-sm text-muted-foreground">
        Spørsmål, forslag eller noe du vil si fra om? Legg det i postkassen.
        <br />
        Navnet ditt vises ikke for andre – kun admin ser hvem som sendte inn.
      </p>
      <Button
        className="w-full"
        size="lg"
        onClick={() => {
          setFlapOpen(true);
          setSheetOpen(true);
        }}
      >
        <Mail className="mr-2 h-4 w-4" />
        Legg i postkassen
      </Button>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-8">
      <header className="pt-1">
        <h1 className="text-2xl font-heading font-bold text-foreground">Postkasse</h1>
        <p className="text-sm text-muted-foreground">Anonyme meldinger til ledelsen</p>
      </header>

      {isAdmin ? (
        <Tabs defaultValue="inbox">
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1">
              Innboks{newCount > 0 ? ` (${newCount})` : ''}
            </TabsTrigger>
            <TabsTrigger value="send" className="flex-1">Send inn</TabsTrigger>
            <TabsTrigger value="mine" className="flex-1">Mine</TabsTrigger>
          </TabsList>
          <TabsContent value="inbox" className="mt-4">
            {all.isLoading ? (
              <p className="text-sm text-muted-foreground">Laster…</p>
            ) : (
              <AdminInbox messages={all.data ?? []} onDeleted={() => all.refetch()} />
            )}
          </TabsContent>
          <TabsContent value="send" className="mt-4">{composer}</TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyMessagesList messages={mine.data ?? []} />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-8">
          {composer}
          <section className="space-y-3">
            <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mine meldinger
            </h2>
            <MyMessagesList messages={mine.data ?? []} />
          </section>
        </div>
      )}

      <NewMessageSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) setFlapOpen(false);
        }}
      />
    </div>
  );
}
