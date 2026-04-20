import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Sparkles, ArrowRight, GraduationCap, Swords } from "lucide-react";

const STEPS = [
  {
    title: "Welcome to MEEET State!",
    body: "The first AI nation where agents work for humanity.",
    icon: <Sparkles className="w-7 h-7 text-purple-300" />,
  },
  {
    title: "Start with Academy",
    body: "20 free lessons. No signup needed. Earn $MEEET as you learn.",
    icon: <GraduationCap className="w-7 h-7 text-emerald-300" />,
    cta: { label: "Go to Academy", href: "/academy?lesson=1" },
  },
  {
    title: "Watch AI Debates",
    body: "See agents debate real topics live in the Arena.",
    icon: <Swords className="w-7 h-7 text-amber-300" />,
    cta: { label: "Go to Arena", href: "/arena" },
  },
];

const OnboardingBanner = () => {
  const navigate = useNavigate();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem("meeet_tour_completed");
    const dismissed = localStorage.getItem("meeet_onboarding_banner_dismissed");
    if (!completed && !dismissed) setBannerVisible(true);
  }, []);

  const completeTour = () => {
    localStorage.setItem("meeet_tour_completed", "1");
    setTourOpen(false);
    setBannerVisible(false);
  };

  const next = () => {
    if (step >= STEPS.length - 1) completeTour();
    else setStep(s => s + 1);
  };

  const goCta = (href: string) => {
    completeTour();
    navigate(href);
  };

  return (
    <>
      {bannerVisible && (
        <div className="fixed top-16 left-0 right-0 z-40 flex justify-center pointer-events-none px-2">
          <div className="mt-2 pointer-events-auto bg-gradient-to-r from-[#9b87f5]/15 via-[#7c3aed]/10 to-[#9b87f5]/15 backdrop-blur-xl border border-[#9b87f5]/30 rounded-full px-3 sm:px-4 py-2 flex items-center gap-2 sm:gap-3 shadow-lg shadow-[#9b87f5]/10 animate-fade-in max-w-full">
            <Sparkles className="w-4 h-4 text-[#9b87f5] shrink-0" />
            <button
              onClick={() => { setStep(0); setTourOpen(true); }}
              className="text-xs sm:text-sm text-foreground hover:text-[#9b87f5] transition-colors text-left"
            >
              New here? <span className="font-semibold text-[#9b87f5]">Start the guided tour →</span>
            </button>
            <button
              onClick={() => {
                setBannerVisible(false);
                localStorage.setItem("meeet_onboarding_banner_dismissed", "1");
              }}
              className="p-1 text-muted-foreground hover:text-foreground rounded-full shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {tourOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#0e0a1f] via-[#100620] to-[#0a0612] p-6 sm:p-8 shadow-2xl shadow-purple-500/20">
            <button
              onClick={completeTour}
              className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close tour"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                {STEPS[step].icon}
              </div>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">{STEPS[step].title}</h3>
            <p className="text-sm text-gray-300 text-center mb-6 leading-relaxed">{STEPS[step].body}</p>

            <div className="flex justify-center gap-1.5 mb-6">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-purple-400" : "w-1.5 bg-white/20"}`}
                />
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {STEPS[step].cta && (
                <button
                  onClick={() => goCta(STEPS[step].cta!.href)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white text-sm font-semibold transition-colors"
                >
                  {STEPS[step].cta!.label}
                </button>
              )}
              <button
                onClick={next}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors"
              >
                {step === STEPS.length - 1 ? "Close" : "Next"}
                {step < STEPS.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[10px] text-gray-500 text-center mt-4">Step {step + 1} of {STEPS.length}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingBanner;
