import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
};

export function PageShell({
  eyebrow,
  title,
  description,
  action,
  children,
}: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[#E5BA41]">
          {eyebrow}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-50">
          {title}
        </h1>
        <p className="max-w-2xl text-lg leading-8 text-slate-200">
          {description}
        </p>
      </div>
      {children ? <div>{children}</div> : null}
      <div>{action}</div>
    </main>
  );
}
