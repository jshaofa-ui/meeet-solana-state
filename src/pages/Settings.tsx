import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { SettingsIcon, User, Bell, Monitor, AlertTriangle, Save, Trash2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const AVATARS = ["🤖", "👽", "🦾", "🧠", "👾", "🛸"];

interface NotifPrefs {
  arena: boolean;
  governance: boolean;
  staking: boolean;
  academy: boolean;
  price: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  arena: true,
  governance: true,
  staking: true,
  academy: false,
  price: false,
};

const NOTIF_OPTIONS: { key: keyof NotifPrefs; label: string; desc: string }[] = [
  { key: "arena", label: "Arena debate results", desc: "Get notified when debates conclude" },
  { key: "governance", label: "Governance proposals", desc: "New proposals and voting reminders" },
  { key: "staking", label: "Staking rewards", desc: "Reward distribution and unlock notices" },
  { key: "academy", label: "Academy updates", desc: "New lessons and certifications" },
  { key: "price", label: "Price alerts", desc: "$MEEET price movement alerts" },
];

interface SectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}

const Section = ({ icon: Icon, title, danger, children }: SectionProps) => (
  <div
    className={`rounded-2xl border backdrop-blur p-5 md:p-6 ${
      danger ? "border-red-500/40 bg-red-500/5" : "border-border bg-card/50"
    }`}
  >
    <div className="flex items-center gap-3 mb-5">
      <div className={`p-2 rounded-lg ${danger ? "bg-red-500/15 text-red-400" : "bg-[#9b87f5]/15 text-[#9b87f5]"}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg md:text-xl font-bold">{title}</h2>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

export default function Settings() {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    setName(localStorage.getItem("meeet_display_name") || "");
    setBio(localStorage.getItem("meeet_bio") || "");
    setAvatar(localStorage.getItem("meeet_avatar") || AVATARS[0]);
    setCurrency(localStorage.getItem("meeet_currency") || "USD");
    try {
      const raw = localStorage.getItem("meeet_notification_prefs");
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch { /* noop */ }
  }, []);

  const saveProfile = () => {
    localStorage.setItem("meeet_display_name", name);
    localStorage.setItem("meeet_bio", bio.slice(0, 160));
    localStorage.setItem("meeet_avatar", avatar);
    toast.success("Profile saved");
  };

  const togglePref = (key: keyof NotifPrefs, value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    localStorage.setItem("meeet_notification_prefs", JSON.stringify(next));
  };

  const changeCurrency = (v: string) => {
    setCurrency(v);
    localStorage.setItem("meeet_currency", v);
    toast.success(`Currency set to ${v}`);
  };

  const clearAllData = () => {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("meeet_"))
      .forEach((k) => localStorage.removeItem(k));
    setName("");
    setBio("");
    setAvatar(AVATARS[0]);
    setPrefs(DEFAULT_PREFS);
    setCurrency("USD");
    toast.success("All MEEET data cleared");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="Settings — MEEET"
        description="Customize your MEEET experience: profile, notifications, display preferences, and data controls."
        path="/settings"
      />
      <Navbar />

      <main className="container mx-auto px-4 pt-24 pb-20 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <SettingsIcon className="h-7 w-7 text-[#9b87f5]" />
            <h1 className="text-3xl md:text-4xl font-black">Settings</h1>
          </div>
          <p className="text-muted-foreground">Customize your MEEET experience</p>
        </motion.div>

        <div className="space-y-5">
          <Section icon={User} title="Profile">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your nickname"
                className="mt-1.5"
                maxLength={32}
              />
            </div>

            <div>
              <Label>Avatar</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
                      avatar === a
                        ? "border-[#9b87f5] bg-[#9b87f5]/15 scale-105"
                        : "border-border bg-muted/30 hover:border-[#9b87f5]/40"
                    }`}
                    aria-label={`Choose avatar ${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="bio">
                Bio <span className="text-xs text-muted-foreground">({bio.length}/160)</span>
              </Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="A few words about yourself..."
                className="mt-1.5"
                rows={3}
              />
            </div>

            <Button onClick={saveProfile} className="gap-2 bg-[#9b87f5] hover:bg-[#7E69AB] text-white">
              <Save className="w-4 h-4" /> Save Profile
            </Button>
          </Section>

          <Section icon={Bell} title="Notification Preferences">
            {NOTIF_OPTIONS.map((opt) => (
              <div key={opt.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-sm text-muted-foreground">{opt.desc}</p>
                </div>
                <Switch checked={prefs[opt.key]} onCheckedChange={(v) => togglePref(opt.key, v)} />
              </div>
            ))}
          </Section>

          <Section icon={Monitor} title="Display Preferences">
            <div>
              <Label className="block mb-2">Theme</Label>
              <div className="flex gap-2">
                <Button size="sm" className="bg-[#9b87f5] hover:bg-[#7E69AB] text-white">Dark</Button>
                <Button size="sm" variant="outline" disabled className="gap-2">
                  Light <Badge variant="secondary" className="text-[10px]">Soon</Badge>
                </Button>
              </div>
            </div>

            <div>
              <Label className="block mb-2">Language</Label>
              <Button size="sm" variant="outline" disabled>English</Button>
              <p className="text-xs text-muted-foreground mt-1.5">More languages coming soon</p>
            </div>

            <div>
              <Label htmlFor="currency" className="block mb-2">Currency display</Label>
              <Select value={currency} onValueChange={changeCurrency}>
                <SelectTrigger id="currency" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section icon={AlertTriangle} title="Danger Zone" danger>
            <p className="text-sm text-muted-foreground">
              This will reset your academy progress, staking data, and deployed agents stored locally.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" /> Clear All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all local MEEET data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes academy progress, wallet connection, profile, notification preferences, and
                    deployed agents from this browser. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllData} className="bg-red-600 hover:bg-red-700">
                    Yes, clear everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
