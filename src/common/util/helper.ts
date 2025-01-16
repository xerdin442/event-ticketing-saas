import { User } from "@prisma/client";

export const sanitizeUserOutput = (user: User) => {
  delete user.password;
  delete user.accountNumber;
  delete user.accountName;
  delete user.bankName;
  delete user.twoFAEnabled;
  delete user.twoFASecret;

  return user;
}