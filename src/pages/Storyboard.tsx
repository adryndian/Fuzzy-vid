import React from 'react';
import { StoryboardGrid } from '../components/storyboard/StoryboardGrid';

export const Storyboard: React.FC = () => {
  return (
    <div className="container mx-auto">
      <h1 className="text-2xl font-bold mb-4">Storyboard</h1>
      <StoryboardGrid />
    </div>
  );
};