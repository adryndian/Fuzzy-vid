export default function VideoProgressBar({ progress = 0 }: { progress?: number }) {
  return (
    <div className="w-full space-y-2">
      <div className="w-full aspect-[9/16] bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
        <div className="text-[rgba(239,225,207,0.3)] text-sm">Generating video...</div>
      </div>
      <div className="w-full bg-white/10 rounded-full h-1.5">
        <div
          className="bg-[#F05A25] h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
