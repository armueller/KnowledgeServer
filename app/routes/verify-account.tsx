import type { Route } from './+types/verify-account';
import { data, Form, redirect, useSearchParams } from 'react-router';
import { getRegion, getUserPoolClientId } from '~/env';
import { CognitoIdentityProviderClient, ConfirmSignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import React, { useCallback, useEffect, useState } from 'react';
import { VALID_EMAIL_REGEX, VALID_VERIFICATION_REGEX } from '~/constants';
import { commitSession, getSession } from '~/sessions.server';

export function meta() {
  return [{ title: 'Knowledge Server - Verify' }, { name: 'description', content: 'Knowledge Server - Verify your account' }];
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

export async function action({ request }: Route.ActionArgs): Promise<Response | { error?: string }> {
  const session = await getSession(request.headers.get('Cookie'));

  const formData = await request.formData();
  const email = formData.get('email')?.toString() || '';
  const verification = formData.get('verification')?.toString() || '';

  try {
    const client = new CognitoIdentityProviderClient({ region: getRegion() });
    const command = new ConfirmSignUpCommand({
      ClientId: getUserPoolClientId(),
      Username: email,
      ConfirmationCode: verification,
    });
    await client.send(command);
    return redirect(`/login?email=${encodeURIComponent(email)}`);
  } catch (error) {
    const errorMessage = (error as Error).message.split(':')[1]?.trim() || 'Unknown error occurred, please try again later.';
    session.flash('error', errorMessage);
    return redirect(`/verify-account?email=${encodeURIComponent(email)}`, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }
}

export default function VerifyAccount({ loaderData }: Route.ComponentProps) {
  const { error: submitError } = loaderData;

  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState<Record<string, string>>({
    email: decodeURIComponent(searchParams.get('email') || ''),
  });
  const [formError, setFormError] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResent, setVerificationResent] = useState(false);

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
      } else if (event.target.name === 'verification') {
        if (!VALID_VERIFICATION_REGEX.test(formData.verification)) {
          setFormError((prev) => ({
            ...prev,
            [event.target.name]: 'Verification code should be 6 digits',
          }));
        }
      }
    },
    [formData]
  );

  useEffect(() => {
    setIsLoading(false);
    setVerificationResent(false);
  }, [loaderData, submitError]);

  const resendVerificationCode = useCallback(() => {
    (async () => {
      if (formData.email && !formError.email) {
        setVerificationResent(true);
        await fetch(window.location.origin + '/resend-verification', {
          method: 'POST',
          body: JSON.stringify({ email: formData.email }),
        });
      }
    })();
  }, [formData.email, formError.email]);

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
              Verify your email to complete registration
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
                  value={formData.email}
                  onChange={onFormInputChange}
                  onBlur={validateForm}
                  autoComplete="email"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
                {formError.email && <p className="text-red-500 text-xs italic mt-2">{formError.email}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="verification" className="block text-sm font-medium text-gray-700">
                Verification Code
              </label>
              <div className="mt-1">
                <input
                  id="verification"
                  name="verification"
                  type="text"
                  onChange={onFormInputChange}
                  onBlur={validateForm}
                  required
                  placeholder="Enter 6-digit code"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
                {!formData.verification && (
                  <p className="text-gray-500 text-xs mt-2">Check your email for your verification code</p>
                )}
                {formError.verification && <p className="text-red-500 text-xs italic mt-2">{formError.verification}</p>}
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                onClick={() => setIsLoading(true)}
              >
                {isLoading ? 'Verifying...' : 'Verify Account'}
              </button>
            </div>
            {submitError && <p className="text-red-500 text-sm mt-2 text-center">{submitError}</p>}
          </Form>

          <div className="mt-6">
            {verificationResent ? (
              <p className="text-center text-sm text-green-600">
                Verification email resent successfully
              </p>
            ) : (
              <p className="text-center text-sm text-gray-600">
                Need a new code?{' '}
                <span
                  className={`${formData.email && !formError.email ? 'cursor-pointer' : 'cursor-not-allowed'} font-medium text-blue-600 hover:text-blue-500`}
                  onClick={resendVerificationCode}
                >
                  Resend verification code
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}