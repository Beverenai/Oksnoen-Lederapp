import { ParticipantStatsCard } from "@/components/admin/ParticipantStatsCard";

const ParticipantStats = () => {
  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Deltakerstatistikk</h1>
      <ParticipantStatsCard />
    </div>
  );
};

export default ParticipantStats;
