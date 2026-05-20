export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ongoing" ? "status-ongoing" :
    status === "completed" ? "status-completed" :
    status === "hiatus" ? "status-hiatus" :
    "status-unknown";
  const label = status === "unknown" ? "Unknown" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`status-badge ${cls}`}>{label}</span>;
}
