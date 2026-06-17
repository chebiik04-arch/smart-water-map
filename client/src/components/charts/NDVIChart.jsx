import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { endpoints } from "../../services/api";

const fallback = [{ month: "Dec", value: 0.35 }, { month: "Jan", value: 0.58 }, { month: "Feb", value: 0.68 }, { month: "Mar", value: 0.59 }, { month: "Apr", value: 0.42 }, { month: "May", value: 0.41 }];

export function NDVIChart({ districtId }) {
  const { data = fallback, isLoading } = useQuery({
    queryKey: ["ndvi", districtId],
    queryFn: () => endpoints.ndviSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  return <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-bold">Vegetation Health (NDVI)</h2>{isLoading ? <div className="h-40 animate-pulse rounded bg-black/5" /> : <><ResponsiveContainer width="100%" height={150}><LineChart data={data}><CartesianGrid stroke="#E5E7EB" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 1]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="value" name="NDVI" stroke="#22C55E" strokeWidth={2} dot={{ r: 3, fill: "#22C55E" }} /></LineChart></ResponsiveContainer><p className="mt-2 text-center text-xs text-black/60">NDVI</p></>}</section>;
}
