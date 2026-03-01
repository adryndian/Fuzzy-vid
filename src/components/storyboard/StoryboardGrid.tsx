import useProjectStore from '../../store/projectStore';
import { SceneCard } from '../scene/SceneCard';
import { GlassCard } from '../glass/GlassCard';

export const StoryboardGrid = () => {
  const { project } = useProjectStore();

  if (!project) {
    return <GlassCard className="p-8 flex items-center justify-center"><p className="text-text-muted">Loading project...</p></GlassCard>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {project.scenes.map((scene) => (
        <SceneCard key={scene.scene_id} scene={scene} />
      ))}
    </div>
  );
};
