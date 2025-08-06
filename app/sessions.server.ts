import { createCookieSessionStorage } from 'react-router';
import { getNodeEnv, getOrigin } from './env';

type SessionData = {
  accessToken: string;
};

type SessionFlashData = {
  error: string;
};

const { getSession, commitSession, destroySession } = createCookieSessionStorage<SessionData, SessionFlashData>({
  // a Cookie from `createCookie` or the CookieOptions to create one
  cookie: {
    name: '__session',
    ...(getNodeEnv() === 'local' ? {} : { domain: getOrigin() }),
    httpOnly: true,
    maxAge: 60 * 60 * 24,
    path: '/',
    sameSite: getNodeEnv() === 'local' ? 'lax' : 'strict',
    secure: getNodeEnv() !== 'local',
  },
});

export { getSession, commitSession, destroySession };