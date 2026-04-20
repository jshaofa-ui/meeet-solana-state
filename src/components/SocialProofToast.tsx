import { useEffect, useState } from "react";

const MESSAGES = [
  { icon: "🌍", text: "Someone from Tokyo just joined" },
  { icon: "🎓", text: "A citizen completed Lesson 5" },
  { icon: "🤖", text: "New agent deployed: HealthGuard-7" },
  { icon: "🔬", text: "Discovery published: 'Quantum routing'" },
  { icon: "🌍", text: "Someone from Berlin just joined" },
  { icon: "🏆", text: "Agent NovaCrest won an Arena debate" },
  { icon: "💰", text: "240 $MEEET earned in Oracle market" },
  { icon: "🌍", text: "Someone from São Paulo just joined" },
  { icon: "🎓", text: "A citizen completed Academy Lesson 11" },
  { icon: "🤖", text: "New agent deployed: CipherMind-3" },
  { icon: "🌍", text: "Someone from Mumbai just joined" },
  { icon: "🏛️", text: "New governance vote cast" },
  { icon: "🌍", text: "Someone from Lagos just joined" },
  { icon: "🔥", text: "420 $MEEET burned by Civilization Tax" },
];

const SocialProofToast = () => {
  const [current, setCurrent] = useState<{ icon: string; text: string } | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeoutId: number;
    let hideId: number;

    const schedule = () => {
      const delay = 30000 + Math.random() * 15000; // 30-45s
      timeoutId = window.setTimeout(() => {
        const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        setCurrent(msg);
        setVisible(true);
        hideId = window.setTimeout(() => {
          setVisible(false);
          schedule();
        }, 4000);
      }, delay);
    };

    // First toast after 12s
    timeoutId = window.setTimeout(() => {
      const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      setCurrent(msg);
      setVisible(true);
      hideId = window.setTimeout(() => {
        setVisible(false);
        schedule();
      }, 4000);
    }, 12000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(hideId);
    };
  }, []);

  if (!current) return null;

  return (
    <div
      className={`fixed bottom-24 left-4 z-[60] pointer-events-none transition-all duration-500 ${
        visible ? "translate-x-0 opacity-100" : "-translate-x-[120%] opacity-0"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/80 backdrop-blur-xl border border-purple-500/40 shadow-2xl shadow-purple-500/20 max-w-xs">
        <span className="text-xl">{current.icon}</span>
        <span className="text-sm text-white font-medium">{current.text}</span>
      </div>
    </div>
  );
};

export default SocialProofToast;
