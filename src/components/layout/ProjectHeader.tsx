import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { GlassCard } from '../glass/GlassCard';
import { Badge } from '../ui/badge'; // Assuming you have a Badge component

export const ProjectHeader: React.FC = () => {
  const { project } = useProjectStore();

  if (!project) {
    return null;
  }

  return (
    <GlassCard className="p-4 mb-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-cream">{project.metadata.title}</h1>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">{project.metadata.art_style}</Badge>
          <Badge variant="outline">{project.metadata.mood}</Badge>
        </div>
      </div>
    </GlassCard>
  );
};