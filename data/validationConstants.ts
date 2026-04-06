import * as Yup from 'yup';
import { InferType } from 'yup';

import { fullNameValidation, passwordValidation } from '@/utils';

export const LoginValidationSchema = Yup.object().shape({
  emailOrUsername: Yup.string()
    .required('validation.emailOrUsernameRequired')
    .test('email-or-username', 'validation.emailOrUsernameInvalid', (value) => {
      if (!value) return false;

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      return emailRegex.test(value) || usernameRegex.test(value);
    })
    .label('Email or Username'),
  password: Yup.string().required('validation.passwordRequired').label('Password'),
});
export type LoginFormValues = InferType<typeof LoginValidationSchema>;

export const SignupValidationSchema = Yup.object().shape({
  username: Yup.string()
    .required('validation.usernameRequired')
    .min(3, 'validation.usernameMin')
    .max(20, 'validation.usernameMax')
    .matches(/^[a-zA-Z0-9_]+$/, 'validation.usernamePattern')
    .label('Username'),
  email: Yup.string()
    .required('validation.emailRequired')
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'validation.emailInvalid')
    .label('Email'),
  password: passwordValidation(),
  confirmPassword: Yup.string()
    .required('validation.confirmPasswordRequired')
    .oneOf([Yup.ref('password')], 'validation.passwordsMatch')
    .label('Confirm Password'),
});
export type SignupFormValues = InferType<typeof SignupValidationSchema>;

export const ForgotPasswordValidationSchema = Yup.object().shape({
  email: Yup.string()
    .required('validation.emailRequired')
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'validation.emailInvalid')
    .label('Email'),
});
export type ForgotPasswordFormValues = InferType<typeof ForgotPasswordValidationSchema>;

export const VerifyOtpValidationSchema = Yup.object().shape({
  otp: Yup.string()
    .required('validation.otpRequired')
    .matches(/^\d{6}$/, 'validation.otpExact')
    .label('OTP'),
});
export type VerifyOtpFormValues = InferType<typeof VerifyOtpValidationSchema>;

export const PasswordResetValidationSchema = Yup.object().shape({
  password: passwordValidation(),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'validation.passwordsMatch').required('validation.confirmPasswordRequired'),
});
export type PasswordResetFormValues = InferType<typeof PasswordResetValidationSchema>;

export const ContactFormGuestValidationSchema = Yup.object().shape({
  name: fullNameValidation(),
  email: Yup.string()
    .required('validation.emailRequired')
    .matches(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/, 'validation.emailInvalid')
    .label('Email'),
  phone: Yup.string()
    .required('validation.phoneRequired')
    .matches(/^0[0-9]{9}$/, 'validation.phonePattern')
    .label('Phone'),
  subject: Yup.string()
    .required('validation.subjectRequired')
    .min(5, 'validation.subjectMin')
    .max(200, 'validation.subjectMax')
    .label('Subject'),
  message: Yup.string()
    .required('validation.messageRequired')
    .min(10, 'validation.messageMin')
    .max(2000, 'validation.messageMax')
    .label('Message'),
});
export type ContactFormGuestValues = InferType<typeof ContactFormGuestValidationSchema>;
