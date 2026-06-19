"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpriteCharacter } from "@/components/SpriteCharacter";
import { Lock, Brain, HardDrive, MessageSquare, Shield, Key } from "lucide-react";

export function LandingPage() {
  const router = useRouter();

  const handleLaunch = () => {
    router.push("/app");
  };

  // Listen for navbar "Launch App" click
  useEffect(() => {
    const handler = () => router.push("/app");
    window.addEventListener("open-connect-modal", handler);
    return () => window.removeEventListener("open-connect-modal", handler);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-6">
          <p className="font-headline text-xs font-bold tracking-[0.25em] text-[#63f7ff]">
            AI-POWERED WALRUS ASSISTANT
          </p>
          <h1 className="font-headline text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            AI Copilot with{" "}
            <span className="text-[#63f7ff]">Persistent Memory</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed font-light">
            Encrypted time capsules, decentralized file storage, and cross-session AI memory — all powered by Walrus and owned by you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleLaunch}
              className="bg-[#63f7ff] text-[#002021] px-10 py-4 rounded-xl font-headline font-bold text-base flex items-center justify-center gap-3 hover:bg-cyan-100 transition-all shadow-[0_0_20px_rgba(99,247,255,0.3)]"
            >
              Launch App
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#63f7ff]/20 bg-[#63f7ff]/5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live on Sui Testnet</span>
            </div>
          </div>
        </div>

        {/* Character */}
        <div className="relative flex justify-center items-center">
          <div className="absolute w-[120%] h-[120%] bg-[#63f7ff]/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute w-[85%] h-[85%] border border-[#63f7ff]/20 rounded-full animate-pulse pointer-events-none" />
          <div className="relative z-10">
            <SpriteCharacter animation="idle" size={320} fps={6} />
          </div>
          {/* Speech bubble */}
          <div className="absolute -top-4 -right-2 sm:-right-8 glass-panel p-4 rounded-2xl max-w-[220px] shadow-[0_0_20px_rgba(99,247,255,0.1)]">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2 h-2 rounded-full bg-[#63f7ff] animate-ping" />
              <span className="font-headline text-[9px] text-[#63f7ff] uppercase font-bold tracking-widest">MARINA THINKING</span>
            </div>
            <p className="text-xs leading-snug">
              &quot;Your capsule is encrypted and stored on Walrus. It unlocks in 2 hours.&quot;
            </p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <p className="font-headline text-xs text-[#63f7ff] tracking-[0.25em] font-bold uppercase mb-3">Core Features</p>
          <h3 className="font-headline text-3xl font-semibold">Powered by Walrus Ecosystem</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Lock size={28} />}
            title="Time Capsules"
            description="Encrypt messages with Seal threshold encryption, store on Walrus. Only the recipient can decrypt after the time-lock expires."
            tag="SEAL + WALRUS"
            tagColor="text-[#63f7ff]/60"
          />
          <FeatureCard
            icon={<Brain size={28} />}
            title="AI Memory"
            description="Marina remembers your preferences across sessions via Walrus MemWal. User-owned on-chain accounts with revocable delegate keys."
            tag="PERSISTENT MEMORY"
            tagColor="text-purple-400/60"
          />
          <FeatureCard
            icon={<HardDrive size={28} />}
            title="Decentralized Storage"
            description="Upload files to Walrus with erasure coding. Extend storage epochs on-chain. Download anytime from decentralized nodes."
            tag="WALRUS SDK"
            tagColor="text-green-500/60"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          <FeatureCard
            icon={<MessageSquare size={28} />}
            title="Natural Language DeFi"
            description='Say "Swap 10 SUI to USDC" or "Send 5 SUI to 0x..." — Marina compiles PTBs, shows preview, and executes after your confirmation.'
            tag="INTENT ENGINE"
            tagColor="text-[#63f7ff]/60"
          />
          <FeatureCard
            icon={<Shield size={28} />}
            title="Guardian Protection"
            description="Every transaction scanned for slippage and concentration risks before execution. Nothing runs without your explicit approval."
            tag="RISK ASSESSMENT"
            tagColor="text-yellow-400/60"
          />
          <FeatureCard
            icon={<Key size={28} />}
            title="Dual Authentication"
            description="Connect with wallet extension (Slush) or sign in with Google via zkLogin. No seed phrase needed for Web2 users."
            tag="WALLET + ZKLOGIN"
            tagColor="text-cyan-400/60"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="glass-panel rounded-[2rem] p-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <Stat value="Seal" label="Threshold Encryption" />
            <Stat value="Walrus" label="Decentralized Storage" />
            <Stat value="MemWal" label="AI Memory Layer" />
            <Stat value="zkLogin" label="Passwordless Auth" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[rgba(0,245,255,0.1)] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-headline text-lg font-bold text-[#63f7ff]">Marina</span>
            <p className="text-xs text-muted-foreground mt-1">AI copilot with persistent memory on Walrus.</p>
          </div>
          <p className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            Powered by Walrus
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, tag, tagColor }: {
  icon: React.ReactNode; title: string; description: string; tag: string; tagColor: string;
}) {
  return (
    <div className="glass-panel p-8 rounded-3xl flex flex-col gap-6 hover:-translate-y-2 transition-all duration-300 cursor-pointer">
      <div className="w-14 h-14 rounded-2xl bg-[#63f7ff]/10 flex items-center justify-center text-[#63f7ff]">
        {icon}
      </div>
      <div>
        <h4 className="font-headline text-xl font-bold mb-3">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-[rgba(0,245,255,0.1)]">
        <span className={`font-mono text-[10px] uppercase tracking-widest ${tagColor}`}>{tag}</span>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <h5 className="font-headline text-3xl sm:text-4xl text-[#63f7ff] font-bold mb-1">{value}</h5>
      <p className="font-headline text-[9px] text-muted-foreground uppercase tracking-widest">{label}</p>
    </div>
  );
}
