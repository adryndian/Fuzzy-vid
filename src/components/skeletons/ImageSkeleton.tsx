export default function ImageSkeleton() {
  return (
    <div className="w-full aspect-[9/16] bg-white/5 rounded-2xl border border-white/10 animate-pulse flex items-center justify-center">
      <div className="text-[rgba(239,225,207,0.3)] text-sm">Generating image...</div>
    </div>
  )
}
