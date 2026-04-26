import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { Github, Send, Twitter, MessageCircle, Mail } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SOCIALS = [
  { icon: Twitter, href: "https://x.com/AINationMEEET", label: "Twitter/X" },
  { icon: MessageCircle, href: "https://discord.gg/meeet", label: "Discord" },
  { icon: Send, href: "https://t.me/meeetworld_bot", label: "Telegram" },
  { icon: Github, href: "https://github.com/alxvasilevvv/meeet-solana-state", label: "GitHub" },
];

const Footer = forwardRef<HTMLElement>((_props, ref) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Введите корректный email");
      return;
    }
    toast.success("Подписка оформлена! Добро пожаловать в рассылку MEEET.");
    setEmail("");
  };

  const COLUMNS = [
    {
      title: t("footer.platform"),
      links: [
        { label: t("footer.explore"), href: "/explore" },
        { label: t("footer.arena"), href: "/arena" },
        { label: "Лидерборд", href: "/leaderboard" },
        { label: t("footer.marketplace"), href: "/marketplace" },
        { label: "Oracle", href: "/oracle" },
        { label: "Секторы", href: "/sectors" },
        { label: "Коллаборации", href: "/collaborations" },
        { label: t("footer.staking"), href: "/staking" },
        { label: t("footer.governance"), href: "/governance" },
      ],
    },
    {
      title: t("footer.resources"),
      links: [
        { label: t("footer.developerPortal"), href: "/developer" },
        { label: "Интеграции", href: "/integrations" },
        { label: "DID Resolver", href: "/did-resolver" },
        { label: "Кроссволк", href: "/crosswalk" },
        { label: "Уровни паспорта", href: "/passport-grades" },
        { label: "Trust API", href: "/trust-api" },
        { label: "API Playground", href: "/api-playground" },
        { label: "История изменений", href: "/changelog" },
        { label: "FAQ", href: "/faq" },
        { label: t("footer.statusPage"), href: "/live" },
        { label: t("footer.blog"), href: "/herald" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.about"), href: "/about" },
        { label: t("footer.careers"), href: "/about" },
        { label: t("footer.contact"), href: "/about" },
        { label: t("footer.termsOfService"), href: "/terms" },
        { label: t("footer.privacyPolicy"), href: "/privacy" },
      ],
    },
  ];

  return (
    <footer ref={ref} className="bg-gray-950 border-t border-purple-500/20">
      <div className="footer-gradient-top" />
      <div className="py-12 px-4">
        <div className="container max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          <div className="space-y-4 col-span-2 md:col-span-1">
            <Link to="/" className="text-xl font-black tracking-tight text-white">MEEET</Link>
            <p className="text-xs text-gray-400 leading-relaxed">
              {t("footer.tagline")}
            </p>
            <div className="flex items-center gap-3 pt-1">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-gray-800/50 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white hover:border-purple-500/40 transition-all"
                  aria-label={s.label}
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>

            {/* Newsletter */}
            <form onSubmit={handleSubscribe} className="pt-3 space-y-2">
              <label className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold flex items-center gap-1.5">
                <Mail className="w-3 h-3" /> Рассылка
              </label>
              <div className="flex gap-2 min-w-0">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ваш@email.com"
                  className="h-9 text-xs bg-gray-900/60 border-gray-700/60 text-white placeholder:text-gray-500 min-w-0 flex-1"
                />
                <Button type="submit" size="sm" className="h-9 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0">
                  Подписаться
                </Button>
              </div>
            </form>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label + l.href}>
                    <Link to={l.href} className="text-xs text-gray-400 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
                {col.title === t("footer.resources") && (
                  <li className="pt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-300">Все системы работают</span>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-800 py-5 px-4">
        <div className="container max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <p className="text-[11px] text-gray-400">
            © {new Date().getFullYear()} MEEET STATE. {t("footer.allRights")}
          </p>
          <span className="text-[11px] text-gray-300">{t("footer.builtOnSolana")}</span>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
export default Footer;
