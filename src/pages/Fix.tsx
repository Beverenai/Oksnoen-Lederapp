import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wrench, Send, CheckCircle, AlertTriangle, Lightbulb, Bug } from 'lucide-react';
import { toast } from 'sonner';

type ReportType = 'bug' | 'suggestion' | 'urgent' | 'other';

const reportTypes: { value: ReportType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'bug', label: 'Feil / Bug', icon: Bug, color: 'text-destructive' },
  { value: 'urgent', label: 'Haster!', icon: AlertTriangle, color: 'text-warning' },
  { value: 'suggestion', label: 'Forslag', icon: Lightbulb, color: 'text-primary' },
  { value: 'other', label: 'Annet', icon: Wrench, color: 'text-muted-foreground' },
];

export default function Fix() {
  const { leader } = useAuth();
  const [type, setType] = useState<ReportType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Skriv inn en tittel');
      return;
    }

    if (!description.trim()) {
      toast.error('Skriv inn en beskrivelse');
      return;
    }

    setIsSubmitting(true);

    try {
      // For now, we'll just show a success message
      // In a real implementation, you'd save to a database table
      console.log('Report submitted:', {
        type,
        title,
        description,
        leader_id: leader?.id,
        leader_name: leader?.name,
        submitted_at: new Date().toISOString(),
      });

      setIsSubmitted(true);
      toast.success('Takk for tilbakemeldingen!');
      
      // Reset form after 2 seconds
      setTimeout(() => {
        setIsSubmitted(false);
        setTitle('');
        setDescription('');
        setType('bug');
      }, 3000);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Kunne ikke sende rapporten');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-12 pb-12">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground mb-2">
              Takk for tilbakemeldingen!
            </h2>
            <p className="text-muted-foreground">
              Vi ser på saken så snart som mulig.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Wrench className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Rapporter
          </h1>
          <p className="text-sm text-muted-foreground">
            Meld inn feil, forslag eller andre ting
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Ny rapport</CardTitle>
          <CardDescription>
            Beskriv hva du vil melde inn, så ser vi på det så fort som mulig
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Report Type */}
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {reportTypes.map((rt) => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.value}
                      type="button"
                      onClick={() => setType(rt.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                        type === rt.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${rt.color}`} />
                      <span className="text-sm font-medium">{rt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Tittel</Label>
              <Input
                id="title"
                placeholder="Kort beskrivelse av problemet"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse</Label>
              <Textarea
                id="description"
                placeholder="Forklar detaljert hva som skjer, eller hva du ønsker..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
            </div>

            {/* Submit */}
            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                'Sender...'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send rapport
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}