import React from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'outline': return 'btn-outline';
      case 'ghost': return 'btn-ghost';
      case 'danger': return 'btn-danger';
      case 'primary':
      default: return 'btn-primary';
    }
  };

  const getSizeStyle = (): React.CSSProperties => {
    switch (size) {
      case 'sm': return { padding: '0.4rem 0.8rem', fontSize: '0.8rem' };
      case 'lg': return { padding: '0.8rem 1.6rem', fontSize: '1rem' };
      case 'md':
      default: return {};
    }
  };

  return (
    <button
      className={`btn ${getVariantClass()} ${className}`}
      style={getSizeStyle()}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="health-dot healthy" style={{ width: 8, height: 8 }} />
      ) : (
        icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>
      )}
      {children}
      {!isLoading && icon && iconPosition === 'right' && (
        <span style={{ display: 'inline-flex' }}>{icon}</span>
      )}
    </button>
  );
};
