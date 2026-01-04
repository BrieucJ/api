import { useParams } from "react-router-dom";
import { getAdminModel } from "@/lib/admin/models";
import AdminDetail from "@/components/admin/AdminDetail";

export default function AdminDetailPage() {
  const { modelName, id } = useParams<{ modelName: string; id: string }>();
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

  if (!id) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-destructive">ID is required</div>
      </div>
    );
  }

  return <AdminDetail model={model} id={parseInt(id, 10)} />;
}
