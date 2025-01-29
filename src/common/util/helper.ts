import { User } from "@prisma/client";

export const sanitizeUserOutput = (user: User): User => {
  delete user.password;
  delete user.accountNumber;
  delete user.accountName;
  delete user.bankName;
  delete user.twoFAEnabled;
  delete user.twoFASecret;

  return user;
}

export const validateWebsiteUrl = (url: string): boolean => {
  const pattern: RegExp = /^(https:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-._~:/?#[\]@!$&'()*+,;=]*)?$/;
  return pattern.test(url);
}