const PARTNERS = ["Solana", "Pump.fun", "Jupiter", "Raydium", "Phantom"];

export default function TrustedBy() {
  return (
    <section className="py-8 px-4 border-y border-border/30 bg-card/20">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-5">
          Trusted by builders
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {PARTNERS.map(p => (
            <span
              key={p}
              className="text-base md:text-lg font-bold tracking-tight text-foreground/50 hover:text-foreground transition-opacity opacity-50 hover:opacity-100 cursor-default"
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
