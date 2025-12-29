import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Users,
  Home,
  Calendar,
  Bell,
  Anchor,
  Dumbbell,
  Map as MapIcon,
  BookOpen,
  RefreshCw,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SettingsGroup {
  id: string;
  label: string;
  icon: React.ElementType;
  items: SettingsItem[];
}

export const settingsGroups: SettingsGroup[] = [
  {
    id: 'brukere',
    label: 'Brukere',
    icon: Users,
    items: [
      { id: 'leaders', label: 'Ledere', icon: Users },
      { id: 'participants', label: 'Deltakere', icon: Users },
      { id: 'cabins', label: 'Hytter', icon: Home },
    ],
  },
  {
    id: 'innhold',
    label: 'Innhold',
    icon: Calendar,
    items: [
      { id: 'schedule', label: 'Vaktplan', icon: Calendar },
      { id: 'activities', label: 'Aktiviteter', icon: Dumbbell },
      { id: 'skjaer', label: 'Skjær', icon: MapIcon },
      { id: 'stories', label: 'Historier', icon: BookOpen },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    items: [
      { id: 'push', label: 'Push-varsler', icon: Bell },
      { id: 'rope-control', label: 'Tau-kontroll', icon: Anchor },
      { id: 'sync', label: 'Synkronisering', icon: RefreshCw },
      { id: 'setup', label: 'Oppsett', icon: Settings },
    ],
  },
];

interface AdminSettingsSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  openGroups: Record<string, boolean>;
  onToggleGroup: (groupId: string) => void;
}

export function AdminSettingsSidebar({
  activeSection,
  onSectionChange,
  openGroups,
  onToggleGroup,
}: AdminSettingsSidebarProps) {
  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 hidden md:block overflow-y-auto">
      <nav className="p-3 space-y-1">
        {settingsGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups[group.id]}
            onOpenChange={() => onToggleGroup(group.id)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 rounded-md transition-colors">
              <span className="flex items-center gap-2">
                <group.icon className="h-4 w-4" />
                <span>{group.label}</span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  openGroups[group.id] && 'rotate-180'
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 ml-2 space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors',
                    activeSection === item.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </nav>
    </aside>
  );
}

// Helper to get current section label
export function getSectionLabel(sectionId: string): string {
  for (const group of settingsGroups) {
    const item = group.items.find(i => i.id === sectionId);
    if (item) return item.label;
  }
  return 'Innstillinger';
}
