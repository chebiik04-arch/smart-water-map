import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { endpoints } from "../../services/api";

const fallback = [{ month: "Dec", avgDepth: -13 }, { month: "Jan", avgDepth: -16 }, { month: "Feb", avgDepth: -14 }, { month: "Mar", avgDepth: -17 }, { month: "Apr", avgDepth: -20 }, { month: "May", avgDepth: -24 }];

export function GroundwaterChart({ districtId }) {
  const { data = fallback, isLoading } = useQuery({
    queryKey: ["groundwater", districtId],
    queryFn: () => endpoints.groundwaterSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  return <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-bold">Groundwater Levels</h2>{isLoading ? <div className="h-40 animate-pulse rounded bg-black/5" /> : <><ResponsiveContainer width="100%" height={150}><LineChart data={data}><CartesianGrid stroke="#E5E7EB" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis reversed domain={[-40, 0]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="avgDepth" name="Depth (m)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer><p className="mt-2 text-xs text-emerald-700">* Lower is better</p></>}</section>;
}
