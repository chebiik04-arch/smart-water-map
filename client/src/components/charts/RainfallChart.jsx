import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { endpoints } from "../../services/api";
import { asArray } from "../../utils/apiData";

export function RainfallChart({ districtId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rainfall", districtId],
    queryFn: () => endpoints.rainfallSeries(districtId, { months: 6 }).then((res) => res.data),
    enabled: Boolean(districtId)
  });
  const rows = asArray(data);
  return <ChartShell title="Rainfall Trend (Last 6 Months)" loading={isLoading}>
    {rows.length ? <ResponsiveContainer width="100%" height={150}>
      <BarChart data={rows}>
        <CartesianGrid stroke="#E5E7EB" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="mmTotal" name="Rainfall (mm)" fill="#3B82F6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer> : <EmptyChart message="No rainfall series returned by the backend." />}
    {rows.length > 0 && <Legend color="bg-blue-500" label="Rainfall (mm)" />}
  </ChartShell>;
}

function ChartShell({ title, loading, children }) {
  return <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm"><h2 className="mb-3 text-sm font-bold">{title}</h2>{loading ? <div className="h-40 animate-pulse rounded bg-black/5" /> : children}</section>;
}

function Legend({ color, label }) {
  return <p className="mt-2 flex items-center justify-center gap-2 text-xs text-black/60"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</p>;
}

function EmptyChart({ message }) {
  return <div className="grid h-40 place-items-center rounded bg-black/[0.03] text-sm text-black/50">{message}</div>;
}
