import { cn } from '../../lib/utils';

interface SegmentedControlProps<T extends string> {
  options: { label: string; value: T; }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex items-center justify-center p-1 rounded-lg bg-glass-01 border border-glass-border-02", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-3 py-1 text-sm font-medium rounded-md transition-colors focus:outline-none",
            value === option.value
              ? "bg-glass-04 text-text-primary shadow-sm"
              : "text-text-secondary hover:bg-glass-02"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
