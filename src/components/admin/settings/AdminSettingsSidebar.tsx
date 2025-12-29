import { useEffect } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
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

const settingsGroups: SettingsGroup[] = [
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
  const { setOpenMobile } = useSidebar();

  // Auto-expand group containing active section
  useEffect(() => {
    settingsGroups.forEach((group) => {
      const hasActiveItem = group.items.some((item) => item.id === activeSection);
      if (hasActiveItem && !openGroups[group.id]) {
        onToggleGroup(group.id);
      }
    });
  }, [activeSection]);

  const handleItemClick = (sectionId: string) => {
    onSectionChange(sectionId);
    setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent className="pt-2">
        {settingsGroups.map((group) => (
          <Collapsible
            key={group.id}
            open={openGroups[group.id]}
            onOpenChange={() => onToggleGroup(group.id)}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
                  <span className="flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">{group.label}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden',
                      openGroups[group.id] && 'rotate-180'
                    )}
                  />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          onClick={() => handleItemClick(item.id)}
                          isActive={activeSection === item.id}
                          tooltip={item.label}
                          className={cn(
                            'cursor-pointer transition-colors',
                            activeSection === item.id && 'bg-primary/10 text-primary font-medium'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
