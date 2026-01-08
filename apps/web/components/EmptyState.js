import { ArrowRight } from "lucide-react";

export default function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="card bg-base-100/70 backdrop-blur border border-base-300 shadow-soft">
      <div className="card-body">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{title}</h3>
            <p className="opacity-70 mt-1">{subtitle}</p>

            {actionLabel ? (
              <button className="btn btn-primary mt-4" onClick={onAction}>
                {actionLabel} <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Illustration SVG (simple, classy) */}
          <svg width="220" height="120" viewBox="0 0 220 120" className="opacity-80">
            <defs>
              <linearGradient id="g" x1="0" x2="1">
                <stop offset="0" stopColor="rgba(37,99,235,.55)" />
                <stop offset="1" stopColor="rgba(124,58,237,.45)" />
              </linearGradient>
            </defs>
            <rect x="10" y="18" width="200" height="84" rx="18" fill="rgba(255,255,255,.03)" stroke="rgba(255,255,255,.12)" />
            <path d="M35 78 C60 44, 92 94, 120 60 C142 36, 164 54, 185 42" stroke="url(#g)" strokeWidth="4" fill="none" />
            <circle cx="35" cy="78" r="4" fill="rgba(6,182,212,.9)" />
            <circle cx="120" cy="60" r="4" fill="rgba(37,99,235,.9)" />
            <circle cx="185" cy="42" r="4" fill="rgba(124,58,237,.9)" />
          </svg>
        </div>
      </div>
    </div>
  );
}
