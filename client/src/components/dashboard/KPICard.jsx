export function KPICard({ title, value, subValue, subLabel, icon: Icon, iconBg = "bg-emerald-100 text-emerald-700", valueColor, actionLabel, actionHref }) {
  return (
    <article className="flex min-h-24 items-center justify-between rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${valueColor || ""}`}>{value}</p>
        {(subValue || subLabel) && <p className="mt-1 text-xs text-emerald-700">{subLabel}{subValue}</p>}
        {actionLabel && <a href={actionHref} className="mt-1 inline-block text-xs text-emerald-700">{actionLabel}</a>}
      </div>
      {Icon && <span className={`grid h-14 w-14 place-items-center rounded-full ${iconBg}`}><Icon size={27} /></span>}
    </article>
  );
}
