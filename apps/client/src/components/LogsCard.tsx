import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import LogsCardContent from "./LogsTable";
import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Input } from "./ui/input";

export default function LogsCard() {
  const navigate = useNavigate();
  const logs = useAppStore((state) => state.logs);
  const lastLog = logs[0]?.created_at;
  const [search, setSearch] = useState("");

  return (
    <Card className="hover:shadow-lg transition w-full">
      <CardHeader>
        <CardTitle>
          <Button
            variant="link"
            className="flex items-center text-base font-semibold cursor-pointer"
            onClick={() => navigate("/logs")}
          >
            Logs
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardTitle>
        <CardDescription>
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-1/2 text-sm"
          />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 sm:max-h-80 overflow-y-auto">
          <LogsCardContent />
        </div>
      </CardContent>
      <CardFooter className="flex flex-row gap-2 pt-0 mt-0">
        <div className="text-xs">{logs.length} entries</div>
        <div className="text-xs">
          Dernier log: {lastLog && new Date(lastLog).toISOString()}
        </div>
      </CardFooter>
    </Card>
  );
}
