import 'express-session';

import { JwtPayload } from 'jsonwebtoken';

declare module 'express-session' {
  interface SessionData {
    user: JwtPayload;
    email: string
  }
}
