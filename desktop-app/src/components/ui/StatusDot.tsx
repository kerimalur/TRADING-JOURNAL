interface StatusDotProps {
  color?: 'green' | 'red' | 'yellow' | 'purple' | 'blue';
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const colorMap = {
  green: { dot: 'bg-pnl-positive', ring: 'bg-pnl-positive/30' },
  red: { dot: 'bg-pnl-negative', ring: 'bg-pnl-negative/30' },
  yellow: { dot: 'bg-yellow-500', ring: 'bg-yellow-500/30' },
  purple: { dot: 'bg-accent-primary', ring: 'bg-accent-primary/30' },
  blue: { dot: 'bg-blue-500', ring: 'bg-blue-500/30' },
};

const sizeMap = {
  sm: { dot: 'w-1.5 h-1.5', ring: 'w-3 h-3' },
  md: { dot: 'w-2 h-2', ring: 'w-4 h-4' },
  lg: { dot: 'w-2.5 h-2.5', ring: 'w-5 h-5' },
};

export function StatusDot({
  color = 'green',
  size = 'md',
  pulse = true,
  className = ''
}: StatusDotProps) {
  const colors = colorMap[color];
  const sizes = sizeMap[size];

  return (
    <span className={`relative inline-flex ${className}`}>
      {pulse && (
        <span className={`absolute inset-0 ${sizes.ring} rounded-full ${colors.ring} animate-ping`}
          style={{ animationDuration: '2s' }}
        />
      )}
      <span className={`relative ${sizes.dot} rounded-full ${colors.dot}`} />
    </span>
  );
}
