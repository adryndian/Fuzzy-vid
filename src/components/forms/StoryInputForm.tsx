import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBrainGenerate } from '../../hooks/useBrainGenerate'

type Platform = 'youtube_shorts' | 'reels' | 'tiktok'
type BrainModel = 'gemini' | 'llama4_maverick' | 'claude_sonnet'
type Language = 'id' | 'en'
type ArtStyle = 'cinematic_realistic' | 'anime_stylized' | 'comic_book' | '3d_render' | 'oil_painting' | 'pixel_art'

const platforms: { id: Platform; label: string; emoji: string }[] = [
  { id: 'youtube_shorts', label: 'YouTube Shorts', emoji: '▶️' },
  { id: 'reels', label: 'Reels', emoji: '📸' },
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
]

const brainModels: { id: BrainModel; label: string; desc: string; color: string }[] = [
  { id: 'gemini', label: 'Gemini', desc: 'Fast & Free', color: '#3FA9F6' },
  { id: 'llama4_maverick', label: 'Llama 4', desc: 'Balanced', color: '#A855F7' },
  { id: 'claude_sonnet', label: 'Claude', desc: 'Best Quality', color: '#F05A25' },
]

const artStyles: { id: ArtStyle; label: string; emoji: string }[] = [
  { id: 'cinematic_realistic', label: 'Cinematic', emoji: '🎬' },
  { id: 'anime_stylized', label: 'Anime', emoji: '⛩️' },
  { id: 'comic_book', label: 'Comic', emoji: '💥' },
  { id: '3d_render', label: '3D Render', emoji: '🎮' },
  { id: 'oil_painting', label: 'Oil Paint', emoji: '🎨' },
  { id: 'pixel_art', label: 'Pixel Art', emoji: '👾' },
]

export function StoryInputForm() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [platform, setPlatform] = useState<Platform>('youtube_shorts')
  const [brainModel, setBrainModel] = useState<BrainModel>('gemini')
  const [language, setLanguage] = useState<Language>('id')
  const [artStyle, setArtStyle] = useState<ArtStyle>('cinematic_realistic')
  const [scenes, setScenes] = useState(5)
  const [error, setError] = useState('')

  const { generate, isLoading } = useBrainGenerate()

  const handleSubmit = () => {
    if (!title.trim() || !story.trim()) {
      setError('Please fill in title and story')
      return
    }
    setError('')
    generate({
      title,
      story,
      platform,
      brain_model: brainModel,
      language,
      art_style: artStyle,
      total_scenes: scenes,
    }, {
      onSuccess: (data) => {
        if (data?.project_id) {
          navigate(`/storyboard/${data.project_id}`)
        }
      },
      onError: (err) => {
        setError('Failed to generate. Check your API settings.')
        console.error(err)
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          Story Title
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Enter a catchy title..."
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(239,225,207,0.12)] rounded-xl px-4 py-3 text-[#EFE1CF] placeholder-[rgba(239,225,207,0.3)] text-sm outline-none focus:border-[rgba(240,90,37,0.5)] focus:bg-[rgba(255,255,255,0.08)] transition-all"
        />
      </div>

      {/* Story */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          The Story
        </label>
        <textarea
          value={story}
          onChange={e => setStory(e.target.value)}
          placeholder="Describe your story in detail... The AI will build a cinematic storyboard."
          rows={3}
          className="w-full bg-[rgba(255,255,255,0.06)] border border-[rgba(239,225,207,0.12)] rounded-xl px-4 py-3 text-[#EFE1CF] placeholder-[rgba(239,225,207,0.3)] text-sm outline-none focus:border-[rgba(240,90,37,0.5)] focus:bg-[rgba(255,255,255,0.08)] transition-all resize-none"
        />
      </div>

      {/* Platform */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          Target Platform
        </label>
        <div className="flex gap-2">
          {platforms.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex-1 py-2 px-2 rounded-xl text-xs font-medium border transition-all ${
                platform === p.id
                  ? 'bg-[rgba(240,90,37,0.2)] border-[#F05A25] text-[#F05A25]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(239,225,207,0.1)] text-[rgba(239,225,207,0.6)]'
              }`}>
              {p.emoji} {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Brain */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          AI Brain
        </label>
        <div className="flex gap-2">
          {brainModels.map(m => (
            <button key={m.id} onClick={() => setBrainModel(m.id)}
              className={`flex-1 py-2.5 px-2 rounded-xl text-xs border transition-all ${
                brainModel === m.id
                  ? 'border-[rgba(255,255,255,0.3)] bg-[rgba(255,255,255,0.1)]'
                  : 'border-[rgba(239,225,207,0.08)] bg-[rgba(255,255,255,0.03)]'
              }`}>
              <div className="font-semibold text-[#EFE1CF]">{m.label}</div>
              <div className="text-[rgba(239,225,207,0.5)] mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          Narration Language
        </label>
        <div className="flex gap-2">
          {[{id:'id',label:'🇮🇩 Indonesia'},{id:'en',label:'🇬🇧 English'}].map(l => (
            <button key={l.id} onClick={() => setLanguage(l.id as Language)}
              className={`flex-1 py-2 rounded-xl text-sm border transition-all ${
                language === l.id
                  ? 'bg-[rgba(63,169,246,0.2)] border-[#3FA9F6] text-[#3FA9F6]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(239,225,207,0.1)] text-[rgba(239,225,207,0.6)]'
              }`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Art Style */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          Art Style
        </label>
        <div className="grid grid-cols-3 gap-2">
          {artStyles.map(s => (
            <button key={s.id} onClick={() => setArtStyle(s.id)}
              className={`py-2 px-1 rounded-xl text-xs border transition-all ${
                artStyle === s.id
                  ? 'bg-[rgba(240,90,37,0.2)] border-[#F05A25] text-[#EFE1CF]'
                  : 'bg-[rgba(255,255,255,0.04)] border-[rgba(239,225,207,0.08)] text-[rgba(239,225,207,0.5)]'
              }`}>
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scenes */}
      <div>
        <label className="text-xs text-[rgba(239,225,207,0.6)] uppercase tracking-widest mb-1.5 block">
          Scenes: <span className="text-[#F05A25] font-bold">{scenes}</span>
        </label>
        <input type="range" min={3} max={15} value={scenes}
          onChange={e => setScenes(Number(e.target.value))}
          className="w-full accent-[#F05A25]" />
        <div className="flex justify-between text-xs text-[rgba(239,225,207,0.3)] mt-1">
          <span>3</span><span>15</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-xl px-4 py-2 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button onClick={handleSubmit} disabled={isLoading}
        className="w-full py-4 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-50"
        style={{
          background: isLoading ? 'rgba(240,90,37,0.5)' : '#F05A25',
          boxShadow: isLoading ? 'none' : '0 0 24px rgba(240,90,37,0.4)',
        }}>
        {isLoading ? '✨ Generating...' : '🎬 Generate Storyboard'}
      </button>
    </div>
  )
}
