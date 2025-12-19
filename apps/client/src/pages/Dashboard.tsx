import { useEffect } from "react";
import LogsCard from "@/components/LogsCard";
import { useAppStore } from "@/store/appStore";

export default function Dashboard() {
  const initLogsSSE = useAppStore((state) => state.initLogsSSE);

  useEffect(() => {
    initLogsSSE();
  }, [initLogsSSE]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <LogsCard />
      {/* Add other cards here */}
    </div>
  );
}
