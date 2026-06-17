"use client";

export default function SafetyPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h3 className="font-headline text-xl font-bold flex items-center gap-2">
        
        Safety Audit
      </h3>

      <div className="glass-panel p-5 rounded-2xl space-y-4">
        {/* Status */}
        <div className="flex gap-3 bg-green-500/5 p-4 rounded-xl border border-green-500/20">
          <span className="text-2xl">✅</span>
          <div>
            <h5 className="font-bold text-sm">Guardian AI Active</h5>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              All transactions are scanned for slippage (&gt;1%) and concentration risk (&gt;70% single asset) before preview. Your sessions are protected.
            </p>
          </div>
        </div>

        {/* Verifications */}
        <div className="space-y-2 pt-2">
          <h5 className="font-headline text-xs font-bold text-[#63f7ff] uppercase tracking-wider">ACTIVE VERIFICATIONS</h5>
          <div className="divide-y divide-[rgba(0,245,255,0.1)]">
            <div className="py-2.5 flex justify-between text-xs">
              <span className="font-mono">Cetus Exchange Router</span>
              <span className="text-green-400 font-bold">VERIFIED ✓</span>
            </div>
            <div className="py-2.5 flex justify-between text-xs">
              <span className="font-mono">zkLogin Authentication</span>
              <span className="text-green-400 font-bold">ACTIVE ✓</span>
            </div>
            <div className="py-2.5 flex justify-between text-xs">
              <span className="font-mono">Walrus Memory (MemWal)</span>
              <span className="text-green-400 font-bold">ENCRYPTED ✓</span>
            </div>
            <div className="py-2.5 flex justify-between text-xs">
              <span className="font-mono">Sui PTB Validation</span>
              <span className="text-green-400 font-bold">DRY-RUN ✓</span>
            </div>
          </div>
        </div>

        {/* Risk classes */}
        <div className="space-y-2 pt-4">
          <h5 className="font-headline text-xs font-bold text-[#63f7ff] uppercase tracking-wider">GUARDIAN RISK CLASSES</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-panel p-4 rounded-xl">
              <p className="text-xs font-bold text-yellow-400">⚠️ High Slippage</p>
              <p className="text-[10px] text-muted-foreground mt-1">Flags when price impact &gt; 1%. Shows estimated dollar loss.</p>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <p className="text-xs font-bold text-orange-400">🔶 Concentration</p>
              <p className="text-[10px] text-muted-foreground mt-1">Flags when single asset &gt; 70% portfolio after trade.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
