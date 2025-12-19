import LogsTable from "@/components/LogsTable";

export default function LogsPage() {
  return (
    <div className="w-full min-w-0 h-full flex flex-col">
      <LogsTable showMetaAsContent={false} />
    </div>
  );
}
