import React from 'react';
import { StoryInputForm } from '../components/forms/StoryInputForm';
import { GlassCard } from '../components/glass/GlassCard';
import { Rocket } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-black overflow-hidden py-12 px-4">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[var(--accent-orange)] rounded-full blur-[120px] opacity-20 pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[var(--accent-blue)] rounded-full blur-[120px] opacity-20 pointer-events-none" />
      
      {/* Logo & Title */}
      <div className="relative z-10 text-center mb-10 animate-in fade-in zoom-in duration-1000">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[var(--accent-orange)] to-[#ff8c00] shadow-[var(--glow-orange)]">
            <Rocket size={32} className="text-white" />
          </div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white">
            FUZZY<span className="text-[var(--accent-orange)]">SHORT</span>
          </h1>
        </div>
        <p className="text-lg md:text-xl font-medium text-[var(--text-secondary)] tracking-wide">
          AI-powered short video production
        </p>
      </div>

      {/* Main Content Card */}
      <GlassCard className="relative z-10 w-full max-w-2xl p-8 md:p-10" variant="strong">
        <StoryInputForm />
      </GlassCard>

      {/* Footer Tagline */}
      <div className="relative z-10 mt-12 text-[var(--text-muted)] text-sm font-medium tracking-widest uppercase">
        iOS 26 Liquid Glass Edition
      </div>
    </div>
  );
};
