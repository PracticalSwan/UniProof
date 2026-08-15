interface ModeShellProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function ModeShell({ eyebrow, title, description }: ModeShellProps) {
  return (
    <section className="max-w-[1000px]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-primary">
        {eyebrow.toUpperCase()}
      </p>
      <h1 className="mt-5 text-[36px] leading-[1.08] font-bold tracking-[-0.03em] text-foreground sm:text-[42px] sm:leading-[1.1]">
        {title}
      </h1>
      <p className="mt-3 max-w-[790px] text-base leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
