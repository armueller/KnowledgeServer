import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { data, Form, Link, redirect, useSearchParams } from 'react-router';
import type { Route } from './+types/login';
import { getRegion, getUserPoolClientId } from '~/env';
import { useCallback, useEffect, useState } from 'react';
import { VALID_EMAIL_REGEX, VALID_PASSWORD_REGEX } from '~/constants';
import { commitSession, getSession } from '~/sessions.server';

export function meta() {
  return [{ title: 'Knowledge Server - Login' }, { name: 'description', content: 'Knowledge Server - Log in to your account' }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  if (session.has('accessToken')) {
    return redirect('/dashboard');
  }
  return data(
    { error: session.get('error') },
    {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    }
  );
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  try {
    const client = new CognitoIdentityProviderClient({ region: getRegion() });
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: getUserPoolClientId(),
      AuthParameters: {
        USERNAME: email?.toString() || '',
        PASSWORD: password?.toString() || '',
      },
    });
    const result = await client.send(command);
    if (result.AuthenticationResult?.AccessToken) {
      session.set('accessToken', result.AuthenticationResult?.AccessToken || '');
    } else {
      throw new Error('Unknown error occurred, please try again later.');
    }
    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (error) {
    const errorMessage = (error as Error).message.split(':')[1]?.trim() || 'Unknown error occurred, please try again later.';
    session.flash('error', errorMessage);
    return redirect('/login', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const { error: submitError } = loaderData;

  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState<Record<string, string>>({
    email: decodeURIComponent(searchParams.get('email') || ''),
  });
  const [formError, setFormError] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const onFormInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
    setFormError((prev) => ({
      ...prev,
      [event.target.name]: '',
    }));
  }, []);

  const validateForm = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (event.target.name === 'email') {
        if (!VALID_EMAIL_REGEX.test(formData.email)) {
          setFormError((prev) => ({
            ...prev,
            [event.target.name]: 'Please enter a valid email',
          }));
        }
      } else if (event.target.name === 'password') {
        if (!VALID_PASSWORD_REGEX.test(formData.password)) {
          setFormError((prev) => ({
            ...prev,
            [event.target.name]: 'Password must be at least 8 characters long and contain at least 1 uppercase and 1 lowercase character',
          }));
        }
      }
    },
    [formData]
  );

  useEffect(() => {
    setIsLoading(false);
  }, [loaderData, submitError]);

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <img alt="Knowledge Server" src="/knowledge-server-logo-small.png" className="mx-auto h-20 w-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">
              Knowledge Server
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Sign in to access your knowledge graph
            </p>
          </div>
          <Form method="POST" className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  onChange={onFormInputChange}
                  onBlur={validateForm}
                  autoComplete="email"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
                {formError.email && <p className="text-red-500 text-xs italic mt-2">{formError.email}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  onChange={onFormInputChange}
                  onBlur={validateForm}
                  required
                  autoComplete="current-password"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
                {formError.password && <p className="text-red-500 text-xs italic mt-2">{formError.password}</p>}
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                onClick={() => setIsLoading(true)}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            {submitError && <p className="text-red-500 text-sm mt-2 text-center">{submitError}</p>}
          </Form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to={{ pathname: '/register' }} className="font-medium text-blue-600 hover:text-blue-500">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}