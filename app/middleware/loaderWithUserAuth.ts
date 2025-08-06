import { redirect, type LoaderFunction, type LoaderFunctionArgs } from 'react-router';
import { getUserIdFromAccessToken } from '~/aws/cognito/getUserIdFromAccessToken';
import { destroySession, getSession } from '~/sessions.server';

export const loaderWithUserAuth =
  <TContext>(
    loader: LoaderFunction<
      TContext & {
        userId: string;
      }
    >
  ) =>
  async (args: LoaderFunctionArgs<TContext>) => {
    const request = args.request;
    const session = await getSession(request.headers.get('Cookie'));

    const accessToken = session.get('accessToken');
    if (!accessToken) {
      return redirect('/login');
    }

    let userId;
    try {
      userId = await getUserIdFromAccessToken(accessToken);
    } catch (error) {
      session.flash('error', (error as Error).message || 'Unknown error occurred, please try again later.');
      return redirect('/login', {
        headers: {
          'Set-Cookie': await destroySession(session),
        },
      });
    }

    return loader({
      ...args,
      context: { ...args.context, userId },
    });
  };

export const apiLoaderWithUserAuth =
  <TContext>(
    loader: LoaderFunction<
      TContext & {
        userId: string;
      }
    >
  ) =>
  async (args: LoaderFunctionArgs<TContext>) => {
    const request = args.request;
    const session = await getSession(request.headers.get('Cookie'));

    const accessToken = session.get('accessToken');
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Unauthorized access, please log in again.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    let userId;
    try {
      userId = await getUserIdFromAccessToken(accessToken);
    } catch (error) {
      session.flash('error', (error as Error).message || 'Unknown error occurred, please try again later.');
      return new Response(JSON.stringify({ error: 'Unauthorized access, please log in again.' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return loader({
      ...args,
      context: { ...args.context, userId },
    });
  };