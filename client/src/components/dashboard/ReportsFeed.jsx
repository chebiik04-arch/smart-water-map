import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { endpoints } from "../../services/api";

const dot = { red: "bg-red-500", orange: "bg-orange-500", yellow: "bg-yellow-400", gray: "bg-gray-400" };

export function ReportsFeed({ districtId, limit = 5 }) {
  const { data = [] } = useQuery({
    queryKey: ["reports-feed", districtId, limit],
    queryFn: () => endpoints.communityReports({ districtId, limit }).then((res) => res.data)
  });

  return (
    <section className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="font-bold">Recent Reports</h2>
        <a href="/reports" className="text-xs font-medium text-blue-600">View all</a>
      </div>
      <div className="divide-y divide-black/10">
        {data.slice(0, limit).map((report) => (
          <a key={report.id} href={`/reports/${report.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
            <span className={`h-3 w-3 rounded-full ${dot[report.severityColor] || dot.yellow}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{report.description}</p>
              <p className="text-xs text-black/55">{report.timeAgo}</p>
            </div>
            <ChevronRight size={15} className="text-black/35" />
          </a>
        ))}
      </div>
    </section>
  );
}
