import { useProjectStore } from '../../store/projectStore';
import { GlassCard } from '../glass/GlassCard';
import { ImageTab } from './tabs/ImageTab';
import { VideoTab } from './tabs/VideoTab';
import { AudioTab } from './tabs/AudioTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export const SceneWorkspace = () => {
  const { activeSceneId, getScene } = useProjectStore();
  const activeScene = activeSceneId ? getScene(activeSceneId) : null;

  if (!activeScene) {
    return (
      <GlassCard className="p-8 flex items-center justify-center">
        <p className="text-text-muted">Select a scene from the storyboard to begin.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
        <Tabs defaultValue="image">
            <TabsList>
                <TabsTrigger value="image">Image</TabsTrigger>
                <TabsTrigger value="video" disabled={activeScene.status.image !== 'approved'}>Video</TabsTrigger>
                <TabsTrigger value="audio" disabled={activeScene.status.video !== 'approved'}>Audio</TabsTrigger>
            </TabsList>
            <TabsContent value="image">
                <ImageTab scene={activeScene} />
            </TabsContent>
            <TabsContent value="video">
                <VideoTab scene={activeScene} />
            </TabsContent>
            <TabsContent value="audio">
                <AudioTab scene={activeScene} />
            </TabsContent>
        </Tabs>
    </GlassCard>
  );
};
