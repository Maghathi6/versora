import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  className = '',
  dot = false,
}) => {
  const getBadgeClass = () => {
    switch (variant) {
      case 'success': return 'badge-success';
      case 'warning': return 'badge-warning';
      case 'danger': return 'badge-danger';
      case 'info': return 'badge-info';
      case 'neutral': return 'badge-neutral';
      case 'brand':
      default: return 'badge-brand';
    }
  };

  return (
    <span className={`badge ${getBadgeClass()} ${className}`}>
      {dot && (
        <span
          className={`health-dot ${variant === 'success' ? 'healthy' : variant === 'danger' ? 'error' : ''}`}
          style={{ width: 6, height: 6 }}
        />
      )}
      {children}
    </span>
  );
};
