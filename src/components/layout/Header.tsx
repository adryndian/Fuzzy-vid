import { Link } from 'react-router-dom';
import { Rocket, Settings } from 'lucide-react';
import { GlassButton } from '../glass/GlassButton';

export const Header = () => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-glass-border-01 bg-bg-surface/70 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center space-x-2">
          <Rocket className="text-accent-orange" />
          <span className="text-lg font-bold text-text-primary">Fuzzy Short</span>
        </Link>
        <div className="flex items-center space-x-4">
          <Link to="/settings">
            <GlassButton>
              <Settings size={16} />
            </GlassButton>
          </Link>
        </div>
      </div>
    </header>
  );
};
