import { HookupGraph } from '@/components/liggeliste/HookupGraph';

const names = ['Nils Berg','Hanna Holme','Aksel Lundin','Line Dahl','Mia Milligan','Bengt Rud','Sara Vik','Jonas Aas','Emma Lie','Tobias Ek','Ida Moen','Kasper Ro','Thea Sund','Oskar Nes','Maja Foss','Elias Haug','Nora Bakke','Sander Wold'];
const leaders = names.map((n, i) => ({ id: `l${i}`, name: n, profile_image_url: `https://i.pravatar.cc/150?img=${i + 5}` })) as any[];
const pairs: [number, number][] = [[0,1],[0,4],[1,2],[2,3],[3,5],[4,6],[5,7],[6,8],[7,9],[8,10],[9,11],[10,12],[11,13],[12,14],[13,15],[14,0],[15,1],[2,9],[3,11],[5,14],[6,16],[7,17],[16,17],[16,4],[8,13],[0,9],[0,13]];
const hookups = pairs.map(([a,b], i) => ({ id: `h${i}`, leader_a_id: `l${a}`, leader_b_id: `l${b}` })) as any[];

export default function HookupDemo() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <HookupGraph leaders={leaders} hookups={hookups} myLeaderId="l0" />
    </div>
  );
}
