import { useStatusPopup } from '@/hooks/useStatusPopup';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Anchor, 
  Download, 
  Search, 
  Filter,
  Check,
  X,
  Wrench,
  Calendar,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

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
  leader?: { name: string };
  fixed_by_leader?: { name: string };
}

export function RopeControlTab() {
  const { showSuccess, showError, showInfo } = useStatusPopup();
  const [controls, setControls] = useState<RopeControl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rope_controls')
        .select(`
          *,
          leader:leaders!rope_controls_leader_id_fkey(name),
          fixed_by_leader:leaders!rope_controls_fixed_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setControls((data || []) as RopeControl[]);
    } catch (error) {
      console.error('Error loading rope controls:', error);
      showError('Kunne ikke laste taukontroller');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('admin-rope-controls')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'rope_controls'
      }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getOverallStatus = (control: RopeControl) => {
    if (control.fixed_at) return 'fixed';
    const statuses = [control.rope_status, control.harness_status, control.carabiner_status, control.helmet_status];
    return statuses.some(s => s === 'rejected') ? 'rejected' : 'approved';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-600"><Check className="w-3 h-3 mr-1" />Godkjent</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><X className="w-3 h-3 mr-1" />Underkjent</Badge>;
      case 'fixed':
        return <Badge variant="secondary"><Wrench className="w-3 h-3 mr-1" />Fikset</Badge>;
      default:
        return <Badge variant="outline">Ukjent</Badge>;
    }
  };

  const getEquipmentStatusIcon = (status: string) => {
    if (status === 'approved') return <Check className="w-4 h-4 text-green-600" />;
    if (status === 'rejected') return <X className="w-4 h-4 text-destructive" />;
    return <span className="w-4 h-4" />;
  };

  const exportToCSV = () => {
    const headers = [
      'Dato',
      'Tid',
      'Leder',
      'Aktivitet',
      'Tau Status',
      'Tau Kommentar',
      'Sele Status',
      'Sele Kommentar',
      'Karabiner Status',
      'Karabiner Kommentar',
      'Hjelm Status',
      'Hjelm Kommentar',
      'Samlet Status',
      'Fiks Kommentar',
      'Fikset Av',
      'Fikset Tidspunkt',
    ];

    const rows = filteredControls.map(control => [
      format(new Date(control.created_at), 'dd.MM.yyyy'),
      format(new Date(control.created_at), 'HH:mm'),
      control.leader?.name || 'Ukjent',
      control.activity,
      control.rope_status,
      control.rope_comment || '',
      control.harness_status,
      control.harness_comment || '',
      control.carabiner_status,
      control.carabiner_comment || '',
      control.helmet_status,
      control.helmet_comment || '',
      getOverallStatus(control),
      control.fix_comment || '',
      control.fixed_by_leader?.name || '',
      control.fixed_at ? format(new Date(control.fixed_at), 'dd.MM.yyyy HH:mm') : '',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taukontroll-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showSuccess('Eksportert til CSV');
  };

  const filteredControls = controls.filter(control => {
    const matchesSearch = !searchTerm || 
      control.leader?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      control.activity.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActivity = activityFilter === 'all' || control.activity === activityFilter;
    
    const status = getOverallStatus(control);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesActivity && matchesStatus;
  });

  const stats = {
    total: controls.length,
    approved: controls.filter(c => getOverallStatus(c) === 'approved').length,
    rejected: controls.filter(c => getOverallStatus(c) === 'rejected').length,
    fixed: controls.filter(c => getOverallStatus(c) === 'fixed').length,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Totalt kontroller</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <div className="text-sm text-muted-foreground">Godkjent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            <div className="text-sm text-muted-foreground">Underkjent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-muted-foreground">{stats.fixed}</div>
            <div className="text-sm text-muted-foreground">Fikset</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Anchor className="w-5 h-5" />
            Alle taukontroller
          </CardTitle>
          <CardDescription>
            Komplett oversikt over sikkerhetskontroller for tau-utstyr
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Søk etter leder..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Aktivitet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle aktiviteter</SelectItem>
                <SelectItem value="Rappelering">Rappelering</SelectItem>
                <SelectItem value="Klatring">Klatring</SelectItem>
                <SelectItem value="Bruskasse">Bruskasse</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statuser</SelectItem>
                <SelectItem value="approved">Godkjent</SelectItem>
                <SelectItem value="rejected">Underkjent</SelectItem>
                <SelectItem value="fixed">Fikset</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Eksporter
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dato/Tid</TableHead>
                  <TableHead>Leder</TableHead>
                  <TableHead>Aktivitet</TableHead>
                  <TableHead className="text-center">Tau</TableHead>
                  <TableHead className="text-center">Sele</TableHead>
                  <TableHead className="text-center">Karabin</TableHead>
                  <TableHead className="text-center">Hjelm</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detaljer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredControls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Ingen taukontroller funnet
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredControls.map((control) => {
                    const status = getOverallStatus(control);
                    const rejectedItems: { name: string; comment: string | null }[] = [];
                    if (control.rope_comment) rejectedItems.push({ name: 'Tau', comment: control.rope_comment });
                    if (control.harness_comment) rejectedItems.push({ name: 'Sele', comment: control.harness_comment });
                    if (control.carabiner_comment) rejectedItems.push({ name: 'Karabiner', comment: control.carabiner_comment });
                    if (control.helmet_comment) rejectedItems.push({ name: 'Hjelm', comment: control.helmet_comment });
                    
                    return (
                      <TableRow key={control.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(control.created_at), 'dd. MMM', { locale: nb })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(control.created_at), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {control.leader?.name || 'Ukjent'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{control.activity}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {getEquipmentStatusIcon(control.rope_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getEquipmentStatusIcon(control.harness_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getEquipmentStatusIcon(control.carabiner_status)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getEquipmentStatusIcon(control.helmet_status)}
                        </TableCell>
                        <TableCell>{getStatusBadge(status)}</TableCell>
                        <TableCell className="max-w-[300px]">
                          {status === 'fixed' && (
                            <div className="space-y-1">
                              {rejectedItems.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-destructive font-medium">Underkjent:</span>
                                  {rejectedItems.map((item, i) => (
                                    <span key={i} className="text-muted-foreground ml-1">
                                      {item.name}{item.comment && ` (${item.comment.trim()})`}{i < rejectedItems.length - 1 && ','}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {control.fix_comment && (
                                <div className="text-xs">
                                  <span className="text-green-600 font-medium">Fiks:</span>
                                  <span className="text-muted-foreground ml-1">{control.fix_comment}</span>
                                </div>
                              )}
                              {control.fixed_by_leader?.name && control.fixed_at && (
                                <div className="text-xs text-muted-foreground">
                                  Fikset av {control.fixed_by_leader.name} - {format(new Date(control.fixed_at), 'dd. MMM HH:mm', { locale: nb })}
                                </div>
                              )}
                            </div>
                          )}
                          {status === 'rejected' && rejectedItems.length > 0 && (
                            <div className="text-xs">
                              <span className="text-destructive font-medium">Underkjent:</span>
                              {rejectedItems.map((item, i) => (
                                <span key={i} className="text-muted-foreground ml-1">
                                  {item.name}{item.comment && ` (${item.comment.trim()})`}{i < rejectedItems.length - 1 && ','}
                                </span>
                              ))}
                            </div>
                          )}
                          {status === 'approved' && (
                            <span className="text-xs text-muted-foreground">Alt godkjent</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Viser {filteredControls.length} av {controls.length} kontroller
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
