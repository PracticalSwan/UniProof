import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 w-full max-w-[1440px] px-5 pb-8 sm:px-8 lg:px-14">
      <div className="flex flex-col gap-2 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
        <Link href="/" className="font-semibold text-foreground">
          UniProof
        </Link>
        <p>Evidence-first guidance for international students</p>
      </div>
    </footer>
  );
}
