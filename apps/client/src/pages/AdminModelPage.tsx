import { useParams } from "react-router-dom";
import { getAdminModel } from "@/lib/admin/models";
import AdminList from "@/components/admin/AdminList";

export default function AdminModelPage() {
  const { modelName } = useParams<{ modelName: string }>();
  const model = modelName ? getAdminModel(modelName) : undefined;

  if (!model) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-destructive">
          Model "{modelName}" not found
        </div>
      </div>
    );
  }

  return <AdminList model={model} />;
}
