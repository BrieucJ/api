import { useParams } from "react-router-dom";
import { getAdminModel } from "@/lib/admin/models";
import AdminForm from "@/components/admin/AdminForm";

export default function AdminFormPage() {
  const { modelName, id } = useParams<{ modelName: string; id?: string }>();
  const model = modelName ? getAdminModel(modelName) : undefined;
  const isEdit = !!id;

  if (!model) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8 text-destructive">
          Model "{modelName}" not found
        </div>
      </div>
    );
  }

  return (
    <AdminForm
      model={model}
      isEdit={isEdit}
      id={id ? parseInt(id, 10) : undefined}
    />
  );
}
