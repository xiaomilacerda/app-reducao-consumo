import { Sparkles } from "lucide-react";

export default function PageSkeleton({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="wr-screen mx-auto min-h-[58vh] w-full max-w-5xl px-4 py-6 text-white sm:px-7" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-violet-200">
        <Sparkles className="h-4 w-4 animate-pulse" aria-hidden="true" />
        {label}
      </div>
      <div className="animate-pulse space-y-4 motion-reduce:animate-none" aria-hidden="true">
        <div className="h-4 w-36 rounded-full bg-violet-300/15" />
        <div className="h-24 rounded-2xl border border-white/10 bg-violet-300/[.055]" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="h-16 rounded-xl border border-white/10 bg-white/[.045]" />
          <div className="h-16 rounded-xl border border-white/10 bg-white/[.045]" />
        </div>
        <div className="h-28 rounded-2xl border border-white/10 bg-white/[.04]" />
        <div className="h-16 rounded-xl border border-white/10 bg-white/[.04]" />
      </div>
    </div>
  );
}
