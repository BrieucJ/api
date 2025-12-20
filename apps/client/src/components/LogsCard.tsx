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

export default function LogsCard() {
  const navigate = useNavigate();
  const logs = useAppStore((state) => state.logs);
  const lastLog = logs[0]?.created_at;

  return (
    <Card className="hover:shadow-lg transition w-full overflow-hidden">
      <CardHeader>
        <CardTitle>Logs</CardTitle>
        <CardDescription className="flex flex-row gap-2 p-0 m-0">
          <div className="text-xs">{logs.length} entries</div>
          <div className="text-xs">
            Last log: {lastLog && new Date(lastLog).toLocaleString()}
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col min-h-0">
        <div className="flex-1 min-h-0 max-h-96 sm:max-h-80 mx-0 px-0 flex flex-col w-full min-w-0">
          <LogsCardContent />
        </div>
      </CardContent>
    </Card>
  );
}
