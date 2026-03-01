
import React from 'react';
import { cn } from '../../lib/utils';
import { Image as ImageIcon, Loader } from 'lucide-react';

interface ImageSkeletonProps {
  isLoading: boolean;
  className?: string;
}

const ImageSkeleton: React.FC<ImageSkeletonProps> = ({ isLoading, className }) => {
  return (
    <div
      className={cn(
        'w-full h-full flex flex-col items-center justify-center bg-black/30 text-text-muted',
        className
      )}
    >
      {isLoading ? (
        <>
          <Loader className="animate-spin text-accent-blue" size={48} />
          <p className="mt-4 text-sm font-semibold">Generating Image...</p>
          <p className="text-xs text-text-secondary">This can take up to 30 seconds</p>
        </>
      ) : (
        <>
          <ImageIcon size={64} />
          <p className="mt-2 text-lg font-medium">Image will appear here</p>
        </>
      )}
    </div>
  );
};

export { ImageSkeleton };
