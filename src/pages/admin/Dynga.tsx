import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Settings2 } from 'lucide-react';
import { DyngaBoard } from '@/components/admin/dynga/DyngaBoard';
import { AddParticipantsSheet } from '@/components/admin/dynga/AddParticipantsSheet';
import { ManageColumnsSheet } from '@/components/admin/dynga/ManageColumnsSheet';
import { useDyngaRealtime } from '@/hooks/useDynga';

export default function Dynga() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  useDyngaRealtime();

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Du har ikke tilgang til Dynga.
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-heading font-bold truncate">Dynga</h1>
            <p className="hidden sm:block text-sm text-muted-foreground">
              Oversikt over deltageroppførsel
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="default" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Legg til deltager</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline sm:ml-2">Kolonner</span>
          </Button>
        </div>
      </div>

      <DyngaBoard />

      <AddParticipantsSheet open={addOpen} onOpenChange={setAddOpen} />
      <ManageColumnsSheet open={manageOpen} onOpenChange={setManageOpen} />
    </div>
  );
}
