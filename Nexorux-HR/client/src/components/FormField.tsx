import React from 'react';
import { ValidationRule } from '../utils/validation';

interface FormFieldProps {
  label: string;
  name: string;
  value: any;
  onChange: (value: any) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  rules?: ValidationRule;
  options?: { label: string; value: string | number }[];
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  disabled = false,
  error,
  rules,
  options,
  icon,
  rightIcon,
  helperText,
  className = ''
}) => {
  const [touched, setTouched] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const validate = (val: any): string | null => {
    if (!rules) return null;
    
    // Required validation
    if (rules.required && (val === null || val === undefined || val === '')) {
      return 'Este campo es requerido';
    }

    // Skip other validations if value is empty and not required
    if (!rules.required && (val === null || val === undefined || val === '')) {
      return null;
    }

    // String validations
    if (typeof val === 'string') {
      if (rules.minLength && val.length < rules.minLength) {
        return `Debe tener al menos ${rules.minLength} caracteres`;
      }
      if (rules.maxLength && val.length > rules.maxLength) {
        return `No puede exceder ${rules.maxLength} caracteres`;
      }
      if (rules.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(val)) {
          return 'Ingresa un email válido';
        }
      }
      if (rules.pattern && !rules.pattern.test(val)) {
        return 'El formato no es válido';
      }
    }

    // Number validations
    if (typeof val === 'number') {
      if (rules.min !== undefined && val < rules.min) {
        return `Debe ser al menos ${rules.min}`;
      }
      if (rules.max !== undefined && val > rules.max) {
        return `No puede exceder ${rules.max}`;
      }
    }

    // Custom validation
    if (rules.custom) {
      return rules.custom(val);
    }

    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    onChange(newValue);
    
    if (touched && rules) {
      setLocalError(validate(newValue));
    }
  };

  const handleBlur = () => {
    setTouched(true);
    if (rules) {
      setLocalError(validate(value));
    }
  };

  const displayError = error || localError;
  const hasError = touched && displayError;

  const inputProps = {
    name,
    value,
    onChange: handleChange,
    onBlur: handleBlur,
    disabled,
    placeholder,
    required,
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${name}-error` : helperText ? `${name}-helper` : undefined,
    className: `input-field ${hasError ? 'state-error' : ''} ${icon ? 'pl-9' : ''} ${rightIcon ? 'pr-9' : ''} ${className}`
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-secondary text-xs font-semibold">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-3 text-muted" aria-hidden="true">
            {icon}
          </div>
        )}
        
        {rightIcon && (
          <div className="absolute right-3 top-3" aria-hidden="true">
            {rightIcon}
          </div>
        )}
        
        {type === 'textarea' ? (
          <textarea
            {...inputProps}
            rows={4}
            style={{ resize: 'vertical' }}
          />
        ) : type === 'select' ? (
          <select {...inputProps}>
            <option value="">{placeholder || 'Seleccionar...'}</option>
            {options?.map(option => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...inputProps}
            type={type}
            step={type === 'number' ? '0.01' : undefined}
          />
        )}
      </div>

      {hasError && (
        <div 
          id={`${name}-error`}
          className="text-error text-xs flex items-center gap-1"
          role="alert"
        >
          {displayError}
        </div>
      )}

      {helperText && !hasError && (
        <div 
          id={`${name}-helper`}
          className="text-muted text-xs"
        >
          {helperText}
        </div>
      )}
    </div>
  );
};

interface FormProps {
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const Form: React.FC<FormProps> = ({ 
  onSubmit, 
  children, 
  className = '',
  isLoading = false 
}) => {
  return (
    <form 
      onSubmit={onSubmit} 
      className={`flex flex-col gap-4 ${className} ${isLoading ? 'state-loading' : ''}`}
      noValidate
    >
      {children}
    </form>
  );
};