import { z } from "zod";
import { codeField, emailField, passwordField, phoneField, requiredText, stateCodeField } from "./common";

export const signUpSchema = z.object({
  name: requiredText("Your name", 120),
  email: emailField,
  password: passwordField,
  organizationName: requiredText("Business name", 160),
  stateCode: stateCodeField,
  acceptPolicies: z.literal(true, {
    errorMap: () => ({ message: "Please accept the Terms and Privacy Policy." }),
  }),
});
export type SignUpInput = z.input<typeof signUpSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password.").max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

export const resetRequestSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email address or phone number.").max(254),
  channel: z.enum(["EMAIL", "SMS"]).optional(),
});

export const resetVerifySchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  code: codeField,
});

export const resetCompleteSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "The passwords don't match.",
    path: ["confirm"],
  });

export const verifyEmailSchema = z.object({ code: codeField });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "The passwords don't match.",
    path: ["confirm"],
  });

export const profileSchema = z.object({
  name: requiredText("Name", 120),
  phone: phoneField,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(200),
  name: z.string().trim().max(120).optional(),
  password: z.string().max(200).optional(),
  acceptPolicies: z.boolean().optional(),
});
