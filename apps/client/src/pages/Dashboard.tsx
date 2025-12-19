import LogsCard from "@/components/LogsCard";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Other cards below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <LogsCard />
        {/* Add other cards here */}
      </div>
    </div>
  );
}
