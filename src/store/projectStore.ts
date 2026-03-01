import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { ProjectSchema, Scene } from '../types/schema';

interface ProjectState {
  project: ProjectSchema | null;
  activeSceneId: number | null;
  setProject: (project: ProjectSchema) => void;
  setActiveSceneId: (sceneId: number | null) => void;
  updateScene: (sceneId: number, sceneUpdate: Partial<Scene>) => void;
  getScene: (sceneId: number) => Scene | undefined;
}

const useProjectStore = create<ProjectState>()(
  devtools(
    (set, get) => ({
      project: null,
      activeSceneId: null,
      setProject: (project) => set({ project }),
      setActiveSceneId: (sceneId) => set({ activeSceneId: sceneId }),
      updateScene: (sceneId, sceneUpdate) =>
        set((state) => {
          if (!state.project) return state;
          const newScenes = state.project.scenes.map((scene) =>
            scene.scene_id === sceneId ? { ...scene, ...sceneUpdate } : scene
          );
          return {
            project: {
              ...state.project,
              scenes: newScenes,
            },
          };
        }),
      getScene: (sceneId) => {
        const project = get().project;
        return project?.scenes.find((scene) => scene.scene_id === sceneId);
      },
    }),
    { name: 'ProjectStore' }
  )
);

export default useProjectStore;
