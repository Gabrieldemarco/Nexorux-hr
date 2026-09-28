// Form validation utilities

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  min?: number;
  max?: number;
  custom?: (value: any) => string | null;
}

export interface ValidationRules {
  [field: string]: ValidationRule;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export const validateField = (value: any, rules: ValidationRule): string | null => {
  // Required validation
  if (rules.required && (value === null || value === undefined || value === '')) {
    return 'Este campo es requerido';
  }

  // Skip other validations if value is empty and not required
  if (!rules.required && (value === null || value === undefined || value === '')) {
    return null;
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `Debe tener al menos ${rules.minLength} caracteres`;
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return `No puede exceder ${rules.maxLength} caracteres`;
    }
    if (rules.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return 'Ingresa un email válido';
      }
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      return 'El formato no es válido';
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return `Debe ser al menos ${rules.min}`;
    }
    if (rules.max !== undefined && value > rules.max) {
      return `No puede exceder ${rules.max}`;
    }
  }

  // Custom validation
  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
};

export const validateForm = (data: Record<string, any>, rules: ValidationRules): ValidationResult => {
  const errors: ValidationError[] = [];

  Object.keys(rules).forEach(field => {
    const error = validateField(data[field], rules[field]);
    if (error) {
      errors.push({ field, message: error });
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Common validation rules
export const commonRules = {
  email: {
    required: true,
    email: true
  },
  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    custom: (value: string) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Debe contener al menos una letra minúscula';
      if (!/(?=.*[A-Z])/.test(value)) return 'Debe contener al menos una letra mayúscula';
      if (!/(?=.*\d)/.test(value)) return 'Debe contener al menos un número';
      return null;
    }
  },
  name: {
    required: true,
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s'-]+$/
  },
  phone: {
    pattern: /^\+?[\d\s-()]+$/
  },
  salary: {
    required: true,
    min: 0,
    custom: (value: number) => {
      if (value <= 0) return 'El salario debe ser mayor a 0';
      return null;
    }
  },
  date: {
    required: true,
    custom: (value: string) => {
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      if (date > new Date()) return 'La fecha no puede ser futura';
      return null;
    }
  }
};

// HR-specific validation rules
export const hrRules = {
  employee: {
    first_name: commonRules.name,
    last_name: commonRules.name,
    email: commonRules.email,
    phone: { ...commonRules.phone, required: false },
    national_id: {
      required: true,
      minLength: 8,
      maxLength: 20
    },
    tax_id: {
      required: true,
      minLength: 8,
      maxLength: 20
    },
    hire_date: commonRules.date,
    base_salary: commonRules.salary,
    department_id: { required: true },
    position_id: { required: true },
    company_id: { required: true }
  },
  candidate: {
    first_name: commonRules.name,
    last_name: commonRules.name,
    email: commonRules.email,
    phone: { ...commonRules.phone, required: false },
    job_opening_id: { required: true }
  },
  jobOpening: {
    title: {
      required: true,
      minLength: 5,
      maxLength: 100
    },
    description: {
      required: true,
      minLength: 20,
      maxLength: 2000
    },
    departmentId: { required: true },
    positionId: { required: true },
    openingsCount: {
      required: true,
      min: 1,
      max: 100
    }
  }
};

// React hook for form validation
export const useFormValidation = (
  data: Record<string, any>,
  rules: ValidationRules,
  onChange?: (isValid: boolean, errors: ValidationError[]) => void
) => {
  const validate = (): ValidationResult => {
    const result = validateForm(data, rules);
    if (onChange) {
      onChange(result.isValid, result.errors);
    }
    return result;
  };

  const validateField = (field: string): string | null => {
    if (!rules[field]) return null;
    return validateField(data[field], rules[field]);
  };

  const getFieldError = (field: string): string | null => {
    const result = validateForm(data, { [field]: rules[field] });
    return result.errors.length > 0 ? result.errors[0].message : null;
  };

  return {
    validate,
    validateField,
    getFieldError,
    isValid: () => validateForm(data, rules).isValid
  };
};