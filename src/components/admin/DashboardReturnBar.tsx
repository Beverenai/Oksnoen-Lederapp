import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { clearDashReturn, hasDashReturn } from '@/lib/dashboardReturn';

/** Vises når admin har navigert ut fra dashboardet, så «tilbake» går dit igjen */
export function DashboardReturnBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(hasDashReturn() && location.pathname !== '/admin/dashboard');
  }, [location.pathname]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        clearDashReturn();
        navigate('/admin/dashboard');
      }}
      className="mb-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-transform active:scale-95"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Tilbake til dashboard
    </button>
  );
}
