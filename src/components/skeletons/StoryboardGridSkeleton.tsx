import React from 'react';
import { GlassCard } from '../glass/GlassCard';

export const StoryboardGridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
    {[...Array(5)].map((_, i) => (
      <GlassCard key={i} className="animate-pulse">
        <div className="aspect-[9/16] bg-white/10 rounded-lg" />
        <div className="p-4">
          <div className="h-4 bg-white/20 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </GlassCard>
    ))}
  </div>
);
