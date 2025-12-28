import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
          {title}
        </h1>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Construction className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground">Kommer snart</h3>
          <p className="text-muted-foreground mt-1">
            Denne funksjonen er under utvikling
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
