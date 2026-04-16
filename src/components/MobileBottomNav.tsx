import { Link, useLocation } from "react-router-dom";
import { Home, Eye, Swords, Search, User } from "lucide-react";

const HIDDEN_ON = ["/live", "/tg"];

const ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/oracle", icon: Eye, label: "Oracle" },
  { href: "/arena", icon: Swords, label: "Arena" },
  { href: "/discoveries", icon: Search, label: "Explore" },
  { href: "/dashboard", icon: User, label: "Profile" },
];

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  if (HIDDEN_ON.some(p => pathname.startsWith(p))) return null;

  return (
    <>
      <div className="md:hidden h-20" aria-hidden="true" />
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-black/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {ITEMS.map(({ href, icon: Icon, label }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                to={href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] px-2 py-1.5 transition-colors duration-150 ${active ? "text-[#9b87f5]" : "text-gray-500"}`}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.2 : 1.6} />
                <span className="text-[10px] font-semibold leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
