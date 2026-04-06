import * as Yup from 'yup';

export const passwordValidation = (label = 'Password') =>
  Yup.string()
    .required(`${label} is required`)
    .min(8, `${label} must be at least 8 characters long`)
    .matches(/[A-Z]/, `${label} must contain at least one uppercase letter`)
    .matches(/[a-z]/, `${label} must contain at least one lowercase letter`)
    .matches(/\d/, `${label} must contain at least one number`)
    .label(label);

export const fullNameValidation = () =>
  Yup.string()
    .required('Full name is required')
    .min(2, 'Name must be at least 2 characters long')
    .max(50, 'Name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s-]+$/, 'Name can only contain letters, spaces, and hyphens')
    .label('Full Name');
