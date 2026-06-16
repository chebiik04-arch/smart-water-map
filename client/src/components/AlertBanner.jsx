import { AlertTriangle } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";

export function AlertBanner({ alert }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-danger/20 bg-danger/5 p-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="text-danger" size={18} />
        <p className="text-sm font-medium">{alert.message}</p>
      </div>
      <SeverityBadge level={alert.severity} />
    </div>
  );
}

