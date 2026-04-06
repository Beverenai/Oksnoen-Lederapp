// Shared team utility functions used by LeaderDashboard, LeaderListView, etc.

export const getTeamStyles = (team: string | null): string => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case '1':
    case 'team 1':
      return 'bg-red-500 text-white border-red-500';
    case '2':
    case 'team 2':
      return 'bg-orange-500 text-white border-orange-500';
    case '1f':
    case 'team 1f':
      return 'bg-yellow-400 text-black border-yellow-400';
    case '2f':
    case 'team 2f':
      return 'bg-blue-500 text-white border-blue-500';
    case 'kjøkken':
    case 'kjokken':
      return 'bg-purple-500 text-white border-purple-500';
    case 'sjef':
      return 'bg-slate-600 text-white border-slate-600';
    case 'kordinator':
      return 'bg-pink-500 text-white border-pink-500';
    case 'nurse':
      return 'bg-rose-600 text-white border-rose-600';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const formatTeamDisplay = (team: string | null): string => {
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (['1', '2', '1f', '2f'].includes(teamLower)) {
    return `Team ${team.toUpperCase()}`;
  }
  if (teamLower === 'kjokken') return 'Kjøkken';
  return team;
};

export const formatTeamDisplayMobile = (team: string | null, isAdmin?: boolean, isNurse?: boolean): string => {
  if (isAdmin) return 'A';
  if (isNurse) return 'N';
  if (!team) return '';
  const teamLower = team.toLowerCase().trim();
  if (teamLower === '1' || teamLower === 'team 1') return '1';
  if (teamLower === '2' || teamLower === 'team 2') return '2';
  if (teamLower === '1f' || teamLower === 'team 1f') return '1F';
  if (teamLower === '2f' || teamLower === 'team 2f') return '2F';
  if (teamLower === 'kordinator') return 'K';
  if (teamLower === 'kjokken' || teamLower === 'kjøkken') return 'KJ';
  return team.substring(0, 2).toUpperCase();
};

export const getTeamSortOrder = (team: string | null): number => {
  const teamLower = team?.toLowerCase().trim();
  switch (teamLower) {
    case 'kordinator': return 1;
    case '1':
    case 'team 1': return 2;
    case '2':
    case 'team 2': return 3;
    case '1f':
    case 'team 1f': return 4;
    case '2f':
    case 'team 2f': return 5;
    case 'kjøkken':
    case 'kjokken': return 6;
    default: return 7;
  }
};

export const getFirstName = (fullName: string) => fullName.split(' ')[0];

export const TEAM_FILTERS = [
  { value: '1', label: 'Team 1', color: 'bg-red-500 text-white' },
  { value: '2', label: 'Team 2', color: 'bg-orange-500 text-white' },
  { value: '1f', label: 'Team 1F', color: 'bg-yellow-400 text-black' },
  { value: '2f', label: 'Team 2F', color: 'bg-blue-500 text-white' },
  { value: 'kjøkken', label: 'Kjøkken', color: 'bg-purple-500 text-white' },
  { value: 'kordinator', label: 'Kordinator', color: 'bg-pink-500 text-white' },
];
