import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { MyIncidentsList } from '@/components/incidents/MyIncidentsList';

export default function Hendelser() {
  const navigate = useNavigate();
  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Tilbake">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-heading font-bold">Hendelser</h1>
      </div>
      <MyIncidentsList />
    </div>
  );
}