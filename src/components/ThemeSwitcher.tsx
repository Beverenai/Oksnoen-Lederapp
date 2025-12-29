import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium">Tema</p>
        <p className="text-sm text-muted-foreground">
          Velg utseende for appen
        </p>
      </div>
      <ToggleGroup type="single" value={theme} onValueChange={(value) => value && setTheme(value)}>
        <ToggleGroupItem value="light" aria-label="Lyst tema">
          <Sun className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Mørkt tema">
          <Moon className="h-4 w-4" />
        </ToggleGroupItem>
        <ToggleGroupItem value="system" aria-label="Systemvalg">
          <Monitor className="h-4 w-4" />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
