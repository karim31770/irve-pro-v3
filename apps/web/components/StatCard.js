export default function StatCard({ title, value, subtitle, icon, tone = "primary" }) {
  const ring =
    tone === "primary" ? "ring-primary/30" :
    tone === "secondary" ? "ring-secondary/30" :
    tone === "accent" ? "ring-accent/30" :
    "ring-base-content/10";

  const bg =
    tone === "primary" ? "from-primary/20 to-transparent" :
    tone === "secondary" ? "from-secondary/20 to-transparent" :
    tone === "accent" ? "from-accent/20 to-transparent" :
    "from-base-content/10 to-transparent";

  return (
    <div className={`card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft ring-1 ${ring}`}>
      <div className="card-body">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm opacity-70">{title}</div>
            <div className="text-4xl font-semibold mt-1">{value}</div>
            {subtitle ? <div className="text-sm opacity-70 mt-1">{subtitle}</div> : null}
          </div>
          <div className={`p-3 rounded-2xl bg-gradient-to-b ${bg} border border-base-300`}>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
