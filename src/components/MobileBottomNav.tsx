import { Link, useLocation } from "react-router-dom";
import { Home, Eye, Swords, Search, User } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HIDDEN_ON = ["/live", "/tg"];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const ITEMS = [
    { href: "/", icon: Home, label: t("nav.home") },
    { href: "/oracle", icon: Eye, label: "Oracle" },
    { href: "/arena", icon: Swords, label: t("nav.arenaNav") },
    { href: "/discoveries", icon: Search, label: t("nav.explore") },
    { href: "/dashboard", icon: User, label: t("profile.passport") },
  ];

  return (
    <>
      <div className="md:hidden h-20" aria-hidden="true" />
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary mobile navigation"
      >
        <div className="flex items-center justify-around h-16">
          {ITEMS.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                to={href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] px-2 py-1.5 transition-all duration-150 active:scale-90 ${
                  active ? "text-[#9b87f5]" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Icon
                  className="w-6 h-6 transition-transform duration-150"
                  strokeWidth={active ? 2.4 : 1.6}
                  fill={active ? "currentColor" : "none"}
                  fillOpacity={active ? 0.15 : 0}
                />
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
                {active && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#9b87f5]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
