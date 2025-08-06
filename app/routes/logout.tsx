import { redirect } from 'react-router';
import { destroySession, getSession } from '~/sessions.server';
import type { Route } from './+types/logout';

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  return redirect('/login', {
    headers: {
      'Set-Cookie': await destroySession(session),
    },
  });
}

export default function Logout() {
  return null;
}