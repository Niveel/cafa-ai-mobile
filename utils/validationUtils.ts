import * as Yup from 'yup';

export const passwordValidation = (label = 'Password') =>
  Yup.string()
    .required('validation.passwordRequired')
    .min(8, 'validation.passwordMin')
    .matches(/[A-Z]/, 'validation.passwordUpper')
    .matches(/[a-z]/, 'validation.passwordLower')
    .matches(/\d/, 'validation.passwordNumber')
    .label(label);

export const fullNameValidation = () =>
  Yup.string()
    .required('validation.fullNameRequired')
    .min(2, 'validation.fullNameMin')
    .max(50, 'validation.fullNameMax')
    .matches(/^[a-zA-Z\s-]+$/, 'validation.fullNamePattern')
    .label('Full Name');
