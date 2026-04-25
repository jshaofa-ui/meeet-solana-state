import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { SoonButton } from "@/components/SoonButton";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Lock, TrendingUp, Users, DollarSign, Wallet, Award, Crown, Medal, Sparkles } from "lucide-react";

type DurationOption = { days: number; apy: number; label: string };

const DURATIONS: DurationOption[] = [
  { days: 30, apy: 8, label: "30 дней" },
  { days: 90, apy: 12.5, label: "90 дней" },
  { days: 180, apy: 18, label: "180 дней" },
  { days: 365, apy: 25, label: "365 дней" },
];

const TIERS = [
  {
    name: "Бронза",
    min: 100,
    icon: Medal,
    color: "from-amber-700 to-amber-500",
    benefits: ["Базовое право голоса", "Множитель наград 1x", "Доступ к предложениям сообщества"],
    progress: 100,
  },
  {
    name: "Серебро",
    min: 1000,
    icon: Award,
    color: "from-slate-400 to-slate-200",
    benefits: ["Приоритетная очередь предложений", "Множитель наград 1.5x", "Серебряный значок стейкера", "Ранний доступ к функциям"],
    progress: 65,
  },
  {
    name: "Золото",
    min: 10000,
    icon: Crown,
    color: "from-yellow-500 to-yellow-300",
    benefits: ["Право вето в управлении", "Множитель наград 2x", "Золотой значок стейкера", "Программа разделения дохода", "Прямая связь с советом"],
    progress: 22,
  },
];

const HERO_STATS = [
  { label: "Всего застейкано", value: "847K", suffix: "$MEEET", icon: Lock },
  { label: "Средний APY", value: "12.5%", icon: TrendingUp },
  { label: "Активных стейкеров", value: "1 285", icon: Users },
  { label: "TVL", value: "$6.78K", icon: DollarSign },
];

export default function Staking() {
  const [amount, setAmount] = useState<string>("");
  const [duration, setDuration] = useState<DurationOption>(DURATIONS[1]);

  const balance = 0;
  const numericAmount = parseFloat(amount) || 0;

  const estimatedRewards = useMemo(() => {
    return (numericAmount * (duration.apy / 100) * (duration.days / 365)).toFixed(2);
  }, [numericAmount, duration]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="Стейкинг $MEEET — до 25% APY | MEEET World"
        description="Стейкайте токены $MEEET и получайте награды, обеспечивая работу ИИ-нации. Выбирайте период блокировки 30, 90, 180 или 365 дней с APY до 25%."
      />
      <Navbar />

      <main className="pt-24 pb-20">
        <section className="container mx-auto px-4 text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-display font-bold mb-4 bg-gradient-to-r from-purple-400 via-purple-300 to-cyan-300 bg-clip-text text-transparent"
          >
            Стейкинг $MEEET
          </motion.h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Получайте награды, обеспечивая работу ИИ-нации
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card/60 backdrop-blur p-4">
                <s.icon className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                <div className="text-2xl md:text-3xl font-bold">
                  {s.value} {s.suffix && <span className="text-sm text-muted-foreground">{s.suffix}</span>}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 mb-16">
          <div className="max-w-2xl mx-auto rounded-2xl border border-purple-500/20 bg-gradient-to-br from-card to-purple-950/10 p-6 md:p-8 shadow-2xl shadow-purple-500/10">
            <h2 className="text-2xl font-display font-bold mb-1">Калькулятор стейкинга</h2>
            <p className="text-sm text-muted-foreground mb-6">Оцените награды до блокировки токенов</p>

            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Сумма стейка</label>
                  <span className="text-xs text-muted-foreground">Ваш баланс: {balance} $MEEET</span>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pr-20 text-lg h-12"
                  />
                  <button
                    onClick={() => setAmount(String(balance))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold hover:bg-purple-500/30"
                  >
                    МАКС
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Период блокировки</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.days}
                      onClick={() => setDuration(d)}
                      className={`p-3 rounded-lg border transition-all ${
                        duration.days === d.days
                          ? "border-purple-500 bg-purple-500/15 text-foreground"
                          : "border-border bg-card/40 text-muted-foreground hover:border-purple-500/40"
                      }`}
                    >
                      <div className="text-sm font-bold">{d.label}</div>
                      <div className="text-xs text-purple-300 mt-1">{d.apy}% APY</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Расчётная награда</span>
                  <span className="text-2xl font-bold text-purple-300">+{estimatedRewards} $MEEET</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Период блокировки: {duration.days} дней</span>
                  <span>APY: {duration.apy}%</span>
                </div>
              </div>

              <SoonButton
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-purple-400 hover:opacity-90 text-white font-bold"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Застейкать $MEEET
              </SoonButton>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 mb-16">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">Уровни стейкинга</h2>
            <p className="text-muted-foreground">Большие стейки открывают лучшие награды и право голоса</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TIERS.map((tier) => (
              <div key={tier.name} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6 hover:border-purple-500/40 transition-colors">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <tier.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-display font-bold mb-1">{tier.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">от {tier.min.toLocaleString("ru-RU")} $MEEET</p>

                <ul className="space-y-2 mb-4">
                  {tier.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{b}</span>
                    </li>
                  ))}
                </ul>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Доля уровня</span>
                    <span className="text-purple-300">{tier.progress}%</span>
                  </div>
                  <Progress value={tier.progress} className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 mb-12">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-display font-bold mb-4">Ваши позиции</h2>
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-12 text-center">
              <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">Активных позиций нет. Застейкайте $MEEET, чтобы начать получать доход.</p>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-display font-bold mb-4">История стейкинга</h2>
            <div className="rounded-2xl border border-border bg-card/60 overflow-hidden">
              <table className="w-full">
                <thead className="bg-card/80 border-b border-border">
                  <tr>
                    <th className="text-left text-xs uppercase tracking-wider text-muted-foreground p-3">Дата</th>
                    <th className="text-left text-xs uppercase tracking-wider text-muted-foreground p-3">Действие</th>
                    <th className="text-left text-xs uppercase tracking-wider text-muted-foreground p-3">Сумма</th>
                    <th className="text-left text-xs uppercase tracking-wider text-muted-foreground p-3">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">
                      История стейкинга пока пуста
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
