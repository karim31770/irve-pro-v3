import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, Tooltip, Legend
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

function lastNDays(n = 14) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
}

export default function ProjectsCharts({ projects }) {
  const statusCounts = useMemo(() => {
    const m = { DRAFT: 0, IN_PROGRESS: 0, DONE: 0, ARCHIVED: 0 };
    for (const p of projects) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [projects]);

  const daily = useMemo(() => {
    const days = lastNDays(14);
    const labels = days.map(d => d.toLocaleDateString(undefined, { month: "short", day: "2-digit" }));
    const counts = new Array(days.length).fill(0);
    const idxByTime = new Map(days.map((d, i) => [d.getTime(), i]));
    for (const p of projects) {
      const d = new Date(p.created_at);
      d.setHours(0, 0, 0, 0);
      const i = idxByTime.get(d.getTime());
      if (i != null) counts[i] += 1;
    }
    return { labels, counts };
  }, [projects]);

  const lineData = {
    labels: daily.labels,
    datasets: [{
      label: "Projets créés",
      data: daily.counts,
      borderColor: "rgba(37,99,235,.9)",
      backgroundColor: "rgba(37,99,235,.2)",
      tension: 0.35,
      fill: true,
      pointRadius: 2
    }]
  };

  const doughnutData = {
    labels: ["DRAFT", "IN_PROGRESS", "DONE", "ARCHIVED"],
    datasets: [{
      data: [
        statusCounts.DRAFT ?? 0,
        statusCounts.IN_PROGRESS ?? 0,
        statusCounts.DONE ?? 0,
        statusCounts.ARCHIVED ?? 0
      ],
      backgroundColor: [
        "rgba(255,255,255,.18)",
        "rgba(56,189,248,.55)",
        "rgba(34,197,94,.55)",
        "rgba(148,163,184,.35)"
      ],
      borderColor: "rgba(255,255,255,.12)",
      borderWidth: 1
    }]
  };

  const lineOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: "rgba(229,231,235,.7)" } },
      y: { grid: { color: "rgba(255,255,255,.06)" }, ticks: { color: "rgba(229,231,235,.7)", precision: 0 } }
    }
  };

  const doughnutOptions = {
    responsive: true,
    plugins: { legend: { position: "bottom", labels: { color: "rgba(229,231,235,.75)" } } }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft lg:col-span-3">
        <div className="card-body">
          <div className="text-sm opacity-70">Activité (14 jours)</div>
          <div className="mt-2">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>
      </div>

      <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft lg:col-span-2">
        <div className="card-body">
          <div className="text-sm opacity-70">Répartition des statuts</div>
          <div className="mt-2">
            <Doughnut data={doughnutData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
}
