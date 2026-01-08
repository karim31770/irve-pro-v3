import { ArrowRight, Calendar, BadgeCheck } from "lucide-react";

function Badge({ status }) {
  const cls =
    status === "DONE" ? "badge-success" :
    status === "IN_PROGRESS" ? "badge-info" :
    status === "ARCHIVED" ? "badge-neutral" :
    "badge-outline";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function ProjectCard({ project }) {
  return (
    <a
      href={`/app/projects/${project.id}`}
      className="group card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft hover:-translate-y-0.5 transition-transform"
    >
      <div className="card-body">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate text-lg">{project.name}</div>
            <div className="mt-2 flex items-center gap-2">
              <Badge status={project.status} />
              <span className="text-xs opacity-70 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl border border-base-300 bg-gradient-to-b from-primary/15 to-transparent">
            <BadgeCheck className="w-6 h-6 opacity-90" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm opacity-70">Ouvrir la fiche projet</div>
          <div className="btn btn-sm btn-primary">
            Ouvrir <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </a>
  );
}
