import React from 'react';

export const AudioWaveformSkeleton: React.FC = () => (
  <div className="w-full h-16 bg-white/10 rounded-lg flex items-center justify-between px-4 animate-pulse">
    <div className="h-8 w-1/4 bg-white/20 rounded-lg" />
    <div className="h-8 w-1/4 bg-white/20 rounded-lg" />
    <div className="h-8 w-1/4 bg-white/20 rounded-lg" />
  </div>
);
