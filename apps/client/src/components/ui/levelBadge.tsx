import { Badge } from "@/components/ui/badge";
import type { LogSelectType } from "@shared/types";

function LevelBadge({ level }: { level: LogSelectType["level"] }) {
  const levelColors: Record<LogSelectType["level"], string> = {
    fatal: "bg-red-800 text-white",
    error: "bg-red-600 text-white",
    warn: "bg-yellow-400 text-black",
    info: "bg-blue-500 text-white",
    debug: "bg-gray-500 text-white",
    trace: "bg-gray-300 text-black",
  };

  return <Badge className={`px-2 py-0.5 ${levelColors[level]}`}>{level}</Badge>;
}

export { LevelBadge };
