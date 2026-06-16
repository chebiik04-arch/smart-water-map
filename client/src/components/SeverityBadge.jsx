const classes = {
  NORMAL: "bg-safe/15 text-safe",
  WATCH: "bg-warning/15 text-warning",
  WARNING: "bg-orange-500/15 text-orange-700",
  EMERGENCY: "bg-danger/15 text-danger"
};

export function SeverityBadge({ level }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[level] || classes.NORMAL}`}>
      {level || "NORMAL"}
    </span>
  );
}

