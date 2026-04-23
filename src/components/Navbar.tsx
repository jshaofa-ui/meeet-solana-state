import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Menu, X, LogOut, Bell, ChevronDown, Sun, Moon, Users,
  Compass, Bot, Swords, Coins, Code2, LayoutDashboard, Settings as SettingsIcon, Wallet, Check,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

import NavWalletButton from "@/components/NavWalletButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NavAcademyProgress from "@/components/NavAcademyProgress";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { useLanguage } from "@/i18n/LanguageContext";

interface NavDropdownItem {
  href: string;
  label: string;
  icon: string;
}

interface NavItem {
  href: string;
  label: string;
  children?: NavDropdownItem[];
}

interface MobileLink { href: string; label: string; icon: React.ComponentType<{ className?: string }> }
interface MobileGroup { title: string; links: MobileLink[] }

function useNavItems(): { navItems: NavItem[]; mobileGroups: MobileGroup[] } {
  const { t } = useLanguage();
  return useMemo(() => ({
    navItems: [
      { href: "/discoveries", label: t("nav.explore") },
      {
        href: "/marketplace",
        label: t("nav.agents"),
        children: [
          { href: "/marketplace", label: t("nav.marketplace"), icon: "🛒" },
          { href: "/deploy", label: t("nav.deploy"), icon: "🚀" },
          { href: "/breeding", label: "Лаборатория скрещивания", icon: "🧬" },
          { href: "/models", label: t("nav.models"), icon: "🏆" },
          { href: "/world", label: t("nav.worldMap"), icon: "🗺️" },
        ],
      },
      {
        href: "/live",
        label: "AI Мир",
        children: [
          { href: "/live", label: "Лента активности", icon: "📡" },
          { href: "/simulation", label: "Лаборатория", icon: "🧪" },
          { href: "/consensus", label: "Консенсус", icon: "🌐" },
          { href: "/evolution", label: "Эволюция", icon: "🧬" },
        ],
      },
      {
        href: "/arena",
        label: t("nav.arenaNav"),
        children: [
          { href: "/arena", label: t("nav.debates"), icon: "⚔️" },
          { href: "/leaderboard", label: "Рейтинг", icon: "🏆" },
          { href: "/oracle", label: "Oracle", icon: "🔮" },
          { href: "/parliament", label: t("nav.parliament"), icon: "🏛️" },
          { href: "/sectors", label: "Министерства", icon: "🏛" },
        ],
      },
      {
        href: "/token",
        label: t("nav.economy"),
        children: [
          { href: "/token", label: t("nav.meeet"), icon: "💰" },
          { href: "/staking", label: t("nav.staking"), icon: "🏦" },
          { href: "/oracle", label: "Oracle", icon: "🔮" },
        ],
      },
      {
        href: "/developer",
        label: "Разработчик",
        children: [
          { href: "/developer", label: "Портал разработчика", icon: "🛠️" },
          { href: "/integrations", label: "Интеграции", icon: "🔌" },
          { href: "/did-resolver", label: "DID Resolver", icon: "🆔" },
          { href: "/crosswalk", label: "Crosswalk", icon: "🔀" },
          { href: "/passport-grades", label: "Грейды паспорта", icon: "🎖️" },
          { href: "/api-playground", label: "API Playground", icon: "🧪" },
          { href: "/api", label: "API Документация", icon: "📚" },
          { href: "/changelog", label: "Changelog", icon: "📜" },
          { href: "/status", label: "Статус", icon: "📡" },
        ],
      },
      { href: "/dashboard", label: t("nav.dashboard") },
    ],
    mobileGroups: [
      {
        title: t("nav.explore"),
        links: [
          { href: "/discoveries", label: t("nav.explore"), icon: Compass },
          { href: "/marketplace", label: t("nav.agents"), icon: Bot },
          { href: "/world", label: t("nav.worldMap"), icon: Compass },
        ],
      },
      {
        title: "AI Мир",
        links: [
          { href: "/live", label: "Лента активности", icon: Compass },
          { href: "/simulation", label: "Лаборатория", icon: Compass },
          { href: "/consensus", label: "Консенсус", icon: Compass },
          { href: "/evolution", label: "Эволюция", icon: Compass },
        ],
      },
      {
        title: t("nav.arenaNav"),
        links: [
          { href: "/arena", label: t("nav.arenaNav"), icon: Swords },
          { href: "/oracle", label: "Oracle", icon: Bot },
          { href: "/parliament", label: t("nav.parliament"), icon: Swords },
        ],
      },
      {
        title: t("nav.economy"),
        links: [
          { href: "/token", label: t("nav.economy"), icon: Coins },
          { href: "/staking", label: t("nav.staking"), icon: Coins },
        ],
      },
      {
        title: "Аккаунт",
        links: [
          { href: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
          { href: "/developer", label: "Разработчик", icon: Code2 },
          { href: "/settings", label: "Настройки", icon: SettingsIcon },
        ],
      },
      {
        title: "Ещё",
        links: [
          { href: "/about", label: "О проекте", icon: Compass },
          { href: "/faq", label: "FAQ / Помощь", icon: Compass },
        ],
      },
    ],
  }), [t]);
}

const NavDropdown = ({ item }: { item: NavItem }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const isActive = item.children?.some(c => location.pathname === c.href) || location.pathname === item.href;

  const handleEnter = () => {
    clearTimeout(timeout.current);
    setOpen(true);
  };
  const handleLeave = () => {
    timeout.current = setTimeout(() => setOpen(false), 150);
  };

  if (!item.children) {
    return (
      <Link
        to={item.href}
        className={`relative py-1 hover:text-foreground transition-colors text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      >
        {item.label}
        {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
      </Link>
    );
  }

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link
        to={item.href}
        className={`flex items-center gap-1 py-1 hover:text-foreground transition-colors text-sm ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      >
        {item.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {isActive && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />}
      </Link>
      {open && (
        <div className="absolute top-full left-0 pt-2 z-50">
          <div className="w-56 rounded-lg border border-border bg-popover/95 backdrop-blur-xl shadow-xl p-1.5">
            {item.children.map(child => (
              <Link
                key={child.href}
                to={child.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${location.pathname === child.href ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <span className="text-base">{child.icon}</span>
                <span>{child.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { navItems, mobileGroups } = useNavItems();
  const [walletState, setWalletState] = useState<{ wallet: string; address: string } | null>(null);
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { onlineCitizens, activeAgents } = useRealtimePresence(location.pathname);

  useEffect(() => {
    const sync = () => {
      const w = typeof window !== "undefined" ? localStorage.getItem("meeet_wallet_connected") : null;
      const a = typeof window !== "undefined" ? localStorage.getItem("meeet_wallet_address") : null;
      setWalletState(w && a ? { wallet: w, address: a } : null);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [open, location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notif-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
  };

  const typeIcons: Record<string, string> = {
    dm: "💬", trade: "🔄", alliance: "🤝", duel: "⚔️",
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-xl font-bold tracking-tight text-gradient-primary">MEEET</span>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-xs text-muted-foreground hidden sm:inline">{t("nav.solanaState")}</span>
          </Link>

          {/* Online presence — large screens only */}
          {(onlineCitizens > 0 || activeAgents > 0) && (
            <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <Users className="w-3 h-3" />
              <span>{onlineCitizens}</span>
              <span className="text-border">·</span>
              <span>🤖 {activeAgents}</span>
            </div>
          )}

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-4 text-sm text-muted-foreground">
            {navItems.map(item => (
              <NavDropdown key={item.href} item={item} />
            ))}
          </div>

          {/* Desktop right links */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <NavAcademyProgress />
            <Link
              to="/academy"
              className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
              <span>Академия</span>
              <span className="text-[9px] uppercase tracking-wider opacity-80">Бесплатно</span>
            </Link>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggleTheme} className="p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Toggle theme">
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <LanguageSwitcher />

            {/* Notifications */}
            {user && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Notifications">
                    <Bell className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-bold">{t("nav.notifications")}</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-primary hover:underline" aria-label={t("nav.markAllRead")}>{t("nav.markAllRead")}</button>
                    )}
                  </div>
                  <ScrollArea className="max-h-64">
                    {notifications.length === 0 ? (
                      <p className="text-center text-muted-foreground text-xs py-6">{t("nav.noNotifications")}</p>
                    ) : (
                      <div className="divide-y divide-border">
                        {notifications.map((n: any) => (
                          <Link key={n.id} to="/activity" className={`block px-3 py-2.5 hover:bg-muted/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}>
                            <div className="flex items-start gap-2">
                              <span className="text-sm mt-0.5">{typeIcons[n.type] || "🔔"}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs ${!n.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                                {n.body && <p className="text-[10px] text-muted-foreground truncate">{n.body}</p>}
                                <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                              {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}

            <NavWalletButton />

            {user ? (
              <button onClick={signOut} className="hidden lg:flex items-center p-2 text-muted-foreground hover:text-foreground transition-colors" aria-label={t("nav.signOut")}>
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <Link to="/auth" className="hidden lg:block px-3 py-1.5 text-sm font-semibold bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors">
                {t("nav.signIn")}
              </Link>
            )}

            {/* Hamburger — visible below lg */}
            <button
              onClick={() => setOpen(!open)}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Toggle menu"
            >
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile slide-out drawer from right */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[320px] sm:max-w-[85vw] bg-background border-l border-border shadow-2xl lg:hidden transition-transform duration-300 ease-out flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border/30 shrink-0">
          <span className="text-sm font-bold text-foreground">{t("nav.menu")}</span>
          <button onClick={() => setOpen(false)} className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label="Close menu">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Language switcher in mobile */}
        <div className="px-4 py-3 border-b border-border/20">
          <LanguageSwitcher />
        </div>

        {/* Wallet status */}
        <div className="px-4 py-3 border-b border-border/20">
          <Link
            to="/connect"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors ${
              walletState
                ? "border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15"
                : "border-border bg-muted/30 hover:bg-muted/50"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${walletState ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
              {walletState ? <Check className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-foreground">
                {walletState ? "Кошелёк подключён" : "Кошелёк не подключён"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {walletState
                  ? `${walletState.wallet} · ${walletState.address.slice(0, 4)}...${walletState.address.slice(-4)}`
                  : "Нажмите для подключения"}
              </div>
            </div>
          </Link>
        </div>

        {/* Scrollable grouped links */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {mobileGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.links.map((l) => {
                  const Icon = l.icon;
                  const isActive = location.pathname === l.href;
                  return (
                    <Link
                      key={l.href}
                      to={l.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
                        isActive
                          ? "text-primary bg-primary/10 border-l-2 border-primary"
                          : "text-foreground/90 hover:bg-muted/50 hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 opacity-80" />
                      <span>{l.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="shrink-0 border-t border-border/30 p-4 space-y-2">
          {user ? (
            <button onClick={() => { signOut(); setOpen(false); }} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <LogOut className="w-4 h-4" /> {t("nav.signOut")}
            </button>
          ) : (
            <Link to="/auth" onClick={() => setOpen(false)} className="block text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-colors">
              {t("nav.signIn")}
            </Link>
          )}
          <div className="pt-1">
            <NavWalletButton />
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
