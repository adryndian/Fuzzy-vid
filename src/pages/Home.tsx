import { StoryInputForm } from '../components/forms/StoryInputForm'

export function Home() {
  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🎬</div>
        <h1 className="text-4xl font-bold text-[#EFE1CF] tracking-tight mb-2">
          Fuzzy <span className="text-[#F05A25]">Short</span>
        </h1>
        <p className="text-[rgba(239,225,207,0.6)] text-sm">
          AI-powered short video production
        </p>
      </div>

      {/* Glass Card */}
      <div className="w-full max-w-md relative rounded-2xl border border-[rgba(239,225,207,0.14)] bg-[rgba(255,255,255,0.07)] p-6"
        style={{
          backdropFilter: 'blur(20px) saturate(180%)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
        {/* Specular top edge */}
        <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.5), transparent)' }} />
        <StoryInputForm />
      </div>

      <p className="mt-6 text-[rgba(239,225,207,0.3)] text-xs">
        iOS 26 Liquid Glass Edition
      </p>
    </div>
  )
}
