import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Users,
  FileText,
  Activity,
  RotateCcw,
  Key,
  Cpu,
  ArrowRight,
} from "lucide-react";
import { fetchModels } from "@/lib/admin/schema";
import type { AdminModelInfo } from "@/lib/admin/schema";

const iconMap: Record<string, any> = {
  users: Users,
  logs: FileText,
  metrics: Activity,
  request_snapshots: RotateCcw,
  refresh_tokens: Key,
  worker_stats: Cpu,
};

function getPermissionsBadge(model: AdminModelInfo) {
  if (model.canCreate && model.canEdit && model.canDelete) {
    return <Badge variant="default">Full CRUD</Badge>;
  }
  if (model.canEdit) {
    return <Badge variant="secondary">Read & Edit</Badge>;
  }
  if (model.canDelete) {
    return <Badge variant="secondary">Read & Delete</Badge>;
  }
  return <Badge variant="outline">Read-only</Badge>;
}

export default function AdminIndex() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AdminModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        setLoading(true);
        const data = await fetchModels();
        setModels(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load models");
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Admin Interface</h2>
          <p className="text-sm text-muted-foreground">
            Manage your application data and models
          </p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Admin Interface</h2>
          <p className="text-sm text-muted-foreground">
            Manage your application data and models
          </p>
        </div>
        <div className="text-center py-8 text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Admin Interface</h2>
        <p className="text-sm text-muted-foreground">
          Manage your application data and models
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Models</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Base Path</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model) => {
                  const Icon = iconMap[model.name] || Database;
                  return (
                    <TableRow
                      key={model.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/dashboard/admin/${model.name}`)}
                    >
                      <TableCell>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{model.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{model.pluralName}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">
                          {model.basePath}
                        </code>
                      </TableCell>
                      <TableCell>{getPermissionsBadge(model)}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
