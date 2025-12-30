import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Anchor, 
  Check, 
  X, 
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  History,
  User,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import { hapticSuccess, hapticError, hapticWarning } from '@/lib/capacitorHaptics';

interface RopeControl {
  id: string;
  leader_id: string;
  activity: string;
  rope_status: string;
  rope_comment: string | null;
  harness_status: string;
  harness_comment: string | null;
  carabiner_status: string;
  carabiner_comment: string | null;
  helmet_status: string;
  helmet_comment: string | null;
  assigned_to: string | null;
  fix_comment: string | null;
  fixed_at: string | null;
  fixed_by: string | null;
  created_at: string;
  updated_at: string;
  leaders?: { name: string };
}

interface EquipmentCheck {
  key: 'rope' | 'harness' | 'carabiner' | 'helmet';
  title: string;
  checks: string[];
  status: 'pending' | 'approved' | 'rejected';
  comment: string;
}

const ACTIVITIES = ['Rappelering', 'Klatring', 'Bruskasse'];

const EQUIPMENT_CONFIG: Omit<EquipmentCheck, 'status' | 'comment'>[] = [
  {
    key: 'rope',
    title: 'Tau',
    checks: [
      'Ingen kutt eller slitasje',
      'Endene er hele',
      'Alt ser bra ut',
    ],
  },
  {
    key: 'harness',
    title: 'Sele',
    checks: [
      'Bånd og spenner er hele',
      'Sømmer er fine',
      'Alt fungerer',
    ],
  },
  {
    key: 'carabiner',
    title: 'Karabinkroker',
    checks: [
      'Låsen fungerer',
      'Ingen skader',
      'Lukker seg skikkelig',
    ],
  },
  {
    key: 'helmet',
    title: 'Hjelm',
    checks: [
      'Skallet er helt',
      'Stroppene er hele',
      'Alt fungerer',
    ],
  },
];

export default function RopeControl() {
  const { leader } = useAuth();
  const navigate = useNavigate();
  const [activity, setActivity] = useState<string>('');
  const [equipment, setEquipment] = useState<EquipmentCheck[]>(
    EQUIPMENT_CONFIG.map(e => ({ ...e, status: 'pending', comment: '' }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<RopeControl[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // For fix dialog
  const [pendingFixes, setPendingFixes] = useState<RopeControl[]>([]);
  const [selectedFix, setSelectedFix] = useState<RopeControl | null>(null);
  const [fixComment, setFixComment] = useState('');
  const [isFixing, setIsFixing] = useState(false);

  const loadData = async () => {
    if (!leader) return;
    
    setIsLoading(true);
    try {
      const [historyRes, pendingRes] = await Promise.all([
        supabase
          .from('rope_controls')
          .select('*, leaders!rope_controls_leader_id_fkey(name)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('rope_controls')
          .select('*, leaders!rope_controls_leader_id_fkey(name)')
          .eq('assigned_to', leader.id)
          .is('fixed_at', null),
      ]);
      
      setHistory((historyRes.data || []) as RopeControl[]);
      setPendingFixes((pendingRes.data || []) as RopeControl[]);
    } catch (error) {
      console.error('Error loading rope controls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [leader]);

  // Real-time updates
  useEffect(() => {
    if (!leader) return;

    const channel = supabase
      .channel('rope-control-updates')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rope_controls'
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leader]);

  const updateEquipmentStatus = (key: string, status: 'approved' | 'rejected') => {
    setEquipment(prev => prev.map(e => 
      e.key === key 
        ? { ...e, status, comment: status === 'approved' ? '' : e.comment }
        : e
    ));
  };

  const updateEquipmentComment = (key: string, comment: string) => {
    setEquipment(prev => prev.map(e => 
      e.key === key ? { ...e, comment } : e
    ));
  };

  const sendAdminAlert = async (rejectedItemNames: string[]) => {
    try {
      const response = await supabase.functions.invoke('push-admin-alert', {
        body: {
          title: '⚠️ Tau utstyr underkjent',
          message: `${leader?.name} har underkjent utstyr på ${activity}: ${rejectedItemNames.join(', ')}`,
          url: '/admin-settings',
          alert_type: 'rope_control_rejected',
          sender_name: leader?.name,
        },
      });
      
      if (response.error) {
        console.error('Failed to send admin alert:', response.error);
      } else {
        console.log('Admin alert sent:', response.data);
      }
    } catch (error) {
      console.error('Error sending admin alert:', error);
    }
  };

  const handleSubmit = async () => {
    if (!leader || !activity) {
      toast.error('Velg en aktivitet først');
      return;
    }

    const allChecked = equipment.every(e => e.status !== 'pending');
    if (!allChecked) {
      toast.error('Du må godkjenne eller underkjenne alt utstyr');
      return;
    }

    const rejectedItems = equipment.filter(e => e.status === 'rejected');
    const missingComments = rejectedItems.filter(e => !e.comment.trim());
    if (missingComments.length > 0) {
      toast.error('Du må skrive en kommentar for underkjent utstyr');
      return;
    }

    setIsSubmitting(true);
    try {
      const hasRejected = rejectedItems.length > 0;
      
      const { error } = await supabase
        .from('rope_controls')
        .insert({
          leader_id: leader.id,
          activity,
          rope_status: equipment.find(e => e.key === 'rope')?.status || 'pending',
          rope_comment: equipment.find(e => e.key === 'rope')?.comment || null,
          harness_status: equipment.find(e => e.key === 'harness')?.status || 'pending',
          harness_comment: equipment.find(e => e.key === 'harness')?.comment || null,
          carabiner_status: equipment.find(e => e.key === 'carabiner')?.status || 'pending',
          carabiner_comment: equipment.find(e => e.key === 'carabiner')?.comment || null,
          helmet_status: equipment.find(e => e.key === 'helmet')?.status || 'pending',
          helmet_comment: equipment.find(e => e.key === 'helmet')?.comment || null,
          assigned_to: hasRejected ? leader.id : null,
        });

      if (error) throw error;

      if (hasRejected) {
        // Send push notification to all admins
        const rejectedItemNames = rejectedItems.map(e => e.title);
        sendAdminAlert(rejectedItemNames);
        
        hapticWarning();
        toast.error('Fiks dette!', {
          description: `${rejectedItems.length} utstyr er underkjent og må fikses.`,
        });
      } else {
        hapticSuccess();
        toast.success('Kontroll lagret!', {
          description: 'Alt utstyr er godkjent.',
        });
      }

      // Reset form
      setActivity('');
      setEquipment(EQUIPMENT_CONFIG.map(e => ({ ...e, status: 'pending', comment: '' })));
      loadData();
    } catch (error) {
      console.error('Error saving rope control:', error);
      hapticError();
      toast.error('Kunne ikke lagre kontrollen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFixApprove = async () => {
    if (!selectedFix || !leader) return;
    
    if (!fixComment.trim()) {
      toast.error('Du må skrive hva du gjorde for å fikse utstyret');
      return;
    }

    setIsFixing(true);
    try {
      const { error } = await supabase
        .from('rope_controls')
        .update({
          fix_comment: fixComment,
          fixed_at: new Date().toISOString(),
          fixed_by: leader.id,
          rope_status: 'approved',
          harness_status: 'approved',
          carabiner_status: 'approved',
          helmet_status: 'approved',
        })
        .eq('id', selectedFix.id);

      if (error) throw error;

      hapticSuccess();
      toast.success('Utstyr godkjent!');
      setSelectedFix(null);
      setFixComment('');
      loadData();
    } catch (error) {
      console.error('Error fixing rope control:', error);
      hapticError();
      toast.error('Kunne ikke godkjenne');
    } finally {
      setIsFixing(false);
    }
  };

  const getOverallStatus = (control: RopeControl) => {
    if (control.fixed_at) return 'fixed';
    const statuses = [control.rope_status, control.harness_status, control.carabiner_status, control.helmet_status];
    return statuses.some(s => s === 'rejected') ? 'rejected' : 'approved';
  };

  const getRejectedItems = (control: RopeControl) => {
    const items: string[] = [];
    if (control.rope_status === 'rejected') items.push('Tau');
    if (control.harness_status === 'rejected') items.push('Sele');
    if (control.carabiner_status === 'rejected') items.push('Karabinkroker');
    if (control.helmet_status === 'rejected') items.push('Hjelm');
    return items;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-primary/10">
          <Anchor className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Tau Kontroll</h1>
      </div>

      {/* Pending Fixes Alert */}
      {pendingFixes.length > 0 && (
        <Card className="border border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span className="font-bold text-foreground">
                Du har {pendingFixes.length} utstyr som må fikses!
              </span>
            </div>
            <div className="space-y-2">
              {pendingFixes.map((fix) => (
                <Button
                  key={fix.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setSelectedFix(fix)}
                >
                  <span className="truncate">
                    {fix.activity} - {getRejectedItems(fix).join(', ')}
                  </span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Control Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ny kontroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Activity Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Velg aktivitet
            </label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger>
                <SelectValue placeholder="Velg aktivitet..." />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITIES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipment Checks */}
          {activity && (
            <div className="space-y-4">
              {equipment.map((item) => (
                <Card key={item.key} className="border">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">Sjekk at:</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={item.status === 'approved' ? 'default' : 'outline'}
                          className={item.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => updateEquipmentStatus(item.key, 'approved')}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={item.status === 'rejected' ? 'destructive' : 'outline'}
                          onClick={() => updateEquipmentStatus(item.key, 'rejected')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                      {item.checks.map((check, i) => (
                        <li key={i}>– {check}</li>
                      ))}
                    </ul>
                    {item.status === 'rejected' && (
                      <Textarea
                        placeholder="Beskriv hva som er galt..."
                        value={item.comment}
                        onChange={(e) => updateEquipmentComment(item.key, e.target.value)}
                        className="mt-2"
                      />
                    )}
                    {item.status !== 'pending' && (
                      <Badge 
                        variant={item.status === 'approved' ? 'default' : 'destructive'}
                        className="mt-2"
                      >
                        {item.status === 'approved' ? 'Godkjent' : 'Underkjent'}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'Lagrer...' : 'Lagre kontroll'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historikk ({history.length})
            </div>
            {isHistoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Ingen kontroller ennå</p>
          ) : (
            history.map((control) => {
              const status = getOverallStatus(control);
              return (
                <Card key={control.id} className="border">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={status === 'approved' || status === 'fixed' ? 'default' : 'destructive'}>
                        {control.activity}
                      </Badge>
                      <Badge variant={
                        status === 'approved' ? 'default' :
                        status === 'fixed' ? 'secondary' : 'destructive'
                      }>
                        {status === 'approved' ? 'Godkjent' :
                         status === 'fixed' ? 'Fikset' : 'Underkjent'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {control.leaders?.name || 'Ukjent'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(control.created_at), 'dd. MMM HH:mm', { locale: nb })}
                      </span>
                    </div>
                    {status === 'rejected' && (
                      <p className="text-sm text-destructive mt-2">
                        Underkjent: {getRejectedItems(control).join(', ')}
                      </p>
                    )}
                    {control.fix_comment && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Fiks:</span> {control.fix_comment}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Fix Dialog */}
      <Dialog open={!!selectedFix} onOpenChange={(open) => !open && setSelectedFix(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiks utstyr</DialogTitle>
          </DialogHeader>
          {selectedFix && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground">Aktivitet: {selectedFix.activity}</p>
                <p className="text-sm text-muted-foreground">
                  Registrert: {format(new Date(selectedFix.created_at), 'dd. MMM yyyy HH:mm', { locale: nb })}
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">Underkjent utstyr:</p>
                {selectedFix.rope_status === 'rejected' && (
                  <div className="p-3 bg-destructive/10 rounded-md">
                    <p className="font-medium text-destructive">Tau</p>
                    <p className="text-sm text-muted-foreground">{selectedFix.rope_comment}</p>
                  </div>
                )}
                {selectedFix.harness_status === 'rejected' && (
                  <div className="p-3 bg-destructive/10 rounded-md">
                    <p className="font-medium text-destructive">Sele</p>
                    <p className="text-sm text-muted-foreground">{selectedFix.harness_comment}</p>
                  </div>
                )}
                {selectedFix.carabiner_status === 'rejected' && (
                  <div className="p-3 bg-destructive/10 rounded-md">
                    <p className="font-medium text-destructive">Karabinkroker</p>
                    <p className="text-sm text-muted-foreground">{selectedFix.carabiner_comment}</p>
                  </div>
                )}
                {selectedFix.helmet_status === 'rejected' && (
                  <div className="p-3 bg-destructive/10 rounded-md">
                    <p className="font-medium text-destructive">Hjelm</p>
                    <p className="text-sm text-muted-foreground">{selectedFix.helmet_comment}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Hva gjorde du for å fikse utstyret?
                </label>
                <Textarea
                  placeholder="Beskriv hva du gjorde..."
                  value={fixComment}
                  onChange={(e) => setFixComment(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFix(null)}>
              Avbryt
            </Button>
            <Button onClick={handleFixApprove} disabled={isFixing}>
              {isFixing ? 'Godkjenner...' : 'Godkjenn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
