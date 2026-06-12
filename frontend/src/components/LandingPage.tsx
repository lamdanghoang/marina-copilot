"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SpriteCharacter } from "@/components/SpriteCharacter";

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
            NEXT-GENERATION AI ASSISTANT
          </p>
          <h1 className="font-headline text-4xl sm:text-6xl font-bold tracking-tight leading-tight">
            Intelligent DeFi AI{" "}
            <span className="text-[#63f7ff]">Copilot on Sui</span>
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-lg leading-relaxed font-light">
            Execute complex transactions through natural language. Marina understands your intent,
            optimizes yield, and protects your assets with advanced Guardian technology.
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

          <div className="flex items-center gap-4 mt-2">
            <div className="flex -space-x-3">
              <div className="w-9 h-9 rounded-full border-2 border-background bg-muted" />
              <div className="w-9 h-9 rounded-full border-2 border-background bg-muted" />
              <div className="w-9 h-9 rounded-full border-2 border-background bg-[#2e3637] flex items-center justify-center text-[10px] font-bold text-[#63f7ff]">+10k</div>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Users trust Marina</p>
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
              &quot;I have found the highest yield strategy on Cetus for you.&quot;
            </p>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <p className="font-headline text-xs text-[#63f7ff] tracking-[0.25em] font-bold uppercase mb-3">Core Features</p>
          <h3 className="font-headline text-3xl font-semibold">The Smart DeFi Platform</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon="🧠"
            title="Intent Engine"
            description='No technical expertise needed. Just say "Swap 10 SUI to USDC at the best rate" and Marina handles the rest.'
            tag="SUI INTENT LAYER"
            tagColor="text-[#63f7ff]/60"
          />
          <FeatureCard
            icon="🛡️"
            title="Guardian Protection"
            description="Every transaction is scanned by Guardian risk assessment. Marina alerts you to slippage and concentration risks."
            tag="SAFETY SCORE: AAA"
            tagColor="text-green-500/60"
          />
          <FeatureCard
            icon="🐘"
            title="Walrus Memory"
            description="Marina remembers your preferences in a decentralized Walrus storage that you fully own and control with on-chain keys."
            tag="DECENTRALIZED STORAGE"
            tagColor="text-purple-400/60"
          />
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-6 py-8">
        <div className="glass-panel rounded-[2rem] p-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <Stat value="< 5s" label="Response Time" />
            <Stat value="99.9%" label="Safety Score" />
            <Stat value="200+" label="Automated Tests" />
            <Stat value="2" label="Risk Classes" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[rgba(0,245,255,0.1)] px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span className="font-headline text-lg font-bold text-[#63f7ff]">Marina</span>
            <p className="text-xs text-muted-foreground mt-1">Your AI assistant protecting your DeFi journey on Sui.</p>
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
  icon: string; title: string; description: string; tag: string; tagColor: string;
}) {
  return (
    <div className="glass-panel p-8 rounded-3xl flex flex-col gap-6 hover:-translate-y-2 transition-all duration-300 cursor-pointer">
      <div className="w-14 h-14 rounded-2xl bg-[#63f7ff]/10 flex items-center justify-center text-2xl">
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
