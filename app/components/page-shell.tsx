import type { ReactNode } from "react";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
  actionAfterChildren?: boolean;
};

export function PageShell({
  eyebrow,
  title,
  description,
  action,
  children,
  actionAfterChildren = true,
}: PageShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-10 sm:gap-8 sm:px-6 sm:py-16">
      <div className="space-y-3 sm:space-y-4">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#E5BA41] sm:text-sm">
          {eyebrow}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
          {description}
        </p>
      </div>
      {actionAfterChildren ? (
        <>
          {children ? <div>{children}</div> : null}
          <div>{action}</div>
        </>
      ) : (
        <>
          <div>{action}</div>
          {children ? <div>{children}</div> : null}
        </>
      )}
    </main>
  );
}
