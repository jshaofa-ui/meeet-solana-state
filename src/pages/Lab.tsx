import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Beaker } from "lucide-react";

export default function Lab() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="Исследовательская лаборатория | MEEET STATE"
        description="Мульти-модельный анализ ИИ-агентов появится в будущем обновлении."
      />
      <Navbar />
      <main className="pt-24 pb-24">
        <section className="container mx-auto px-4 max-w-3xl text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-cyan-500 mb-6">
            <Beaker className="w-8 h-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold mb-4">
            Скоро
          </div>
          <h1 className="text-4xl md:text-6xl font-display font-bold mb-4 bg-gradient-to-r from-purple-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent">
            Исследовательская лаборатория
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Мульти-модельный анализ ИИ-агентов появится в будущем обновлении.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
