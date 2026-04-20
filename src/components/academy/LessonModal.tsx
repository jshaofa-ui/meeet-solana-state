import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Coins,
  Sparkles,
  ArrowRight,
  BookOpen,
  HelpCircle,
  Trophy,
  Loader2,
  X,
} from "lucide-react";
import { LESSON_ENRICHMENT } from "@/data/lessonEnrichment";

type ModuleRow = {
  id: string;
  slug: string;
  track: string;
  order_index: number;
  title: string;
  subtitle: string | null;
  estimated_minutes: number;
  reward_meeet: number;
  reward_xp: number;
  content_md: string;
  action_type: string | null;
  action_payload: any;
};

interface LessonModalProps {
  open: boolean;
  module: ModuleRow | null;
  isCompleted: boolean;
  isCompleting: boolean;
  onClose: () => void;
  onComplete: () => Promise<void> | void;
  onNext: () => void;
  hasNext: boolean;
}

const LessonModal = ({
  open,
  module,
  isCompleted,
  isCompleting,
  onClose,
  onComplete,
  onNext,
  hasNext,
}: LessonModalProps) => {
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [showReward, setShowReward] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuizAnswer(null);
      setQuizSubmitted(false);
      setShowReward(false);
    }
  }, [open, module?.slug]);

  if (!module) return null;
  const enrichment = LESSON_ENRICHMENT[module.order_index] || {};
  const quiz = enrichment.quiz;
  const cta = enrichment.cta;
  const quizPassed = quiz ? quizSubmitted && quizAnswer === quiz.correctIndex : true;
  // Derive reward by order_index (DB may be out of date): 1-8 → 10, 9-14 → 25, 15-20 → 50
  const correctReward =
    module.order_index >= 15 ? 50 : module.order_index >= 9 ? 25 : 10;

  const handleComplete = async () => {
    if (quiz && !quizPassed) return;
    setShowReward(true);
    setTimeout(() => setShowReward(false), 1800);
    await onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#0c0a1f] via-[#100a2a] to-[#0a0814] border-purple-500/30 p-0 gap-0">
        {/* Header */}
        <div className="relative p-6 pb-4 border-b border-white/10 bg-gradient-to-r from-purple-600/15 via-violet-600/10 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500/30">
              Lesson #{module.order_index}
            </Badge>
            <Badge variant="outline" className="border-white/15 text-gray-300">
              <Clock className="w-3 h-3 mr-1" /> {module.estimated_minutes} min
            </Badge>
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30">
              <Coins className="w-3 h-3 mr-1" /> +{correctReward} MEEET
            </Badge>
          </div>
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-2xl md:text-3xl text-white font-bold leading-tight pr-8">
              {module.title}
            </DialogTitle>
            {module.subtitle && <p className="text-sm text-gray-300">{module.subtitle}</p>}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Key concepts */}
          {enrichment.keyConcepts && enrichment.keyConcepts.length > 0 && (
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-purple-200">
                <Sparkles className="w-4 h-4" /> Key Concepts
              </div>
              <ul className="space-y-2">
                {enrichment.keyConcepts.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-200">
                    <span className="text-purple-400 mt-0.5">▸</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Markdown content from DB */}
          <div className="prose prose-sm prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-strong:text-white prose-a:text-purple-300">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{module.content_md}</ReactMarkdown>
          </div>

          {/* Quiz */}
          {quiz && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5">
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-violet-200">
                <HelpCircle className="w-4 h-4" /> Quiz
              </div>
              <p className="text-white font-medium mb-4">{quiz.question}</p>
              <div className="space-y-2">
                {quiz.options.map((opt, i) => {
                  const isPicked = quizAnswer === i;
                  const isCorrect = quizSubmitted && i === quiz.correctIndex;
                  const isWrongPick = quizSubmitted && isPicked && i !== quiz.correctIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => !quizSubmitted && setQuizAnswer(i)}
                      disabled={quizSubmitted}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition
                        ${isCorrect ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" : ""}
                        ${isWrongPick ? "border-red-400 bg-red-500/15 text-red-100" : ""}
                        ${!quizSubmitted && isPicked ? "border-purple-400 bg-purple-500/15 text-white" : ""}
                        ${!quizSubmitted && !isPicked ? "border-white/10 bg-white/5 text-gray-200 hover:border-purple-400/50 hover:bg-white/10" : ""}
                      `}
                    >
                      <span className="inline-block w-6 font-mono text-gray-400">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
              {!quizSubmitted ? (
                <Button
                  onClick={() => setQuizSubmitted(true)}
                  disabled={quizAnswer === null}
                  className="mt-4 bg-violet-600 hover:bg-violet-500"
                >
                  Check Answer
                </Button>
              ) : (
                <div
                  className={`mt-4 p-3 rounded-lg text-sm ${
                    quizPassed ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/30" : "bg-red-500/10 text-red-200 border border-red-500/30"
                  }`}
                >
                  {quizPassed ? "✅ Correct! " : "❌ Not quite. "}
                  {quiz.explanation}
                  {!quizPassed && (
                    <button
                      onClick={() => {
                        setQuizSubmitted(false);
                        setQuizAnswer(null);
                      }}
                      className="ml-2 underline hover:text-white"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CTA action */}
          {cta && (
            <Link to={cta.href}>
              <Button
                variant="outline"
                className="w-full h-12 border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-white"
              >
                {cta.label} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 p-5 border-t border-white/10 bg-[#0a0814]/95 backdrop-blur flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <BookOpen className="w-3.5 h-3.5" />
            Reward on completion: <span className="text-amber-400 font-semibold">+{module.reward_meeet} MEEET</span>
          </div>
          <div className="flex gap-2 ml-auto">
            {!isCompleted ? (
              <Button
                onClick={handleComplete}
                disabled={isCompleting || (quiz ? !quizPassed : false)}
                className="bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-500 hover:to-violet-400 text-white font-semibold shadow-lg shadow-purple-600/30"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Lesson
                  </>
                )}
              </Button>
            ) : (
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Completed
              </Badge>
            )}
            {hasNext && (
              <Button
                variant="outline"
                onClick={onNext}
                className="border-white/15 bg-white/5 hover:bg-white/10 text-white"
              >
                Next Lesson <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* Reward animation overlay */}
        {showReward && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-50">
            <div className="animate-scale-in">
              <div className="px-8 py-6 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 text-black font-extrabold text-3xl shadow-2xl shadow-amber-500/50 flex items-center gap-3">
                <Trophy className="w-8 h-8" />
                +{module.reward_meeet} MEEET
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LessonModal;
