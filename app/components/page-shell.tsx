import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
};

export function PageShell({
  eyebrow,
  title,
  description,
  action,
}: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          {title}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-zinc-600">
          {description}
        </p>
      </div>
      <div>{action}</div>
    </main>
  );
}
