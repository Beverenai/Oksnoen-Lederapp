import { MyIncidentsList } from '@/components/incidents/MyIncidentsList';

export default function Hendelser() {
  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="text-xl font-heading font-bold">Hendelser</h1>
        <div className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Skriv inn her alt — stort og smått som har skjedd.
          </p>
        </div>
      </div>
      <MyIncidentsList />
    </div>
  );
}