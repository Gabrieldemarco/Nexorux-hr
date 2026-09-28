import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  variant = 'text',
  animation = 'pulse'
}) => {
  const baseStyles = 'loading-skeleton';
  
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };
  
  const animationStyles = {
    pulse: 'animate-pulse',
    wave: '',
    none: ''
  };
  
  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  
  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${animationStyles[animation]} ${className}`}
      style={style}
      role="status"
      aria-label="Cargando..."
    />
  );
};

interface SkeletonCardProps {
  count?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="card-header">
            <Skeleton width={120} height={20} variant="text" />
            <Skeleton width={80} height={24} variant="rectangular" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton width="100%" height={40} variant="text" />
            <Skeleton width="70%" height={16} variant="text" />
            <Skeleton width="50%" height={16} variant="text" />
          </div>
        </div>
      ))}
    </>
  );
};

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton width={100} height={16} variant="text" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <Skeleton width="80%" height={16} variant="text" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface SkeletonStatsProps {
  count?: number;
}

export const SkeletonStats: React.FC<SkeletonStatsProps> = ({ count = 4 }) => {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card card">
          <div className="stat-header">
            <Skeleton width={100} height={14} variant="text" />
            <div className="stat-icon">
              <Skeleton width={32} height={32} variant="circular" />
            </div>
          </div>
          <div>
            <Skeleton width={80} height={32} variant="text" />
            <Skeleton width="60%" height={14} variant="text" className="mt-2" />
          </div>
          <div className="stat-footer">
            <Skeleton width={80} height={12} variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Cargando...',
  children
}) => {
  if (!isLoading) return <>{children}</>;
  
  return (
    <div className="relative">
      <div className="state-loading">
        {children}
      </div>
      <div 
        className="absolute inset-0 bg-card/80 backdrop-blur-sm flex items-center justify-center z-10"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">{message}</span>
        </div>
      </div>
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md',
  color = 'var(--brand-primary)'
}) => {
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div 
      className={`${sizeStyles[size]} border-2 rounded-full animate-spin`}
      style={{ 
        borderColor: color,
        borderTopColor: 'transparent'
      }}
      role="status"
      aria-label="Cargando"
    />
  );
};