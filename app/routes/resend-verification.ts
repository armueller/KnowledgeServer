import { VALID_EMAIL_REGEX } from '~/constants';
import type { Route } from './+types/resend-verification';
import { getRegion, getUserPoolClientId } from '~/env';
import { CognitoIdentityProviderClient, ResendConfirmationCodeCommand } from '@aws-sdk/client-cognito-identity-provider';

export async function action({ request }: Route.ActionArgs) {
  const body = await request.json();
  if (!body.email) {
    return new Response(JSON.stringify({ error: 'No email given' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  if (!VALID_EMAIL_REGEX.test(body.email)) {
    return new Response(JSON.stringify({ error: 'Email invalid' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const client = new CognitoIdentityProviderClient({ region: getRegion() });
  const command = new ResendConfirmationCodeCommand({
    ClientId: getUserPoolClientId(),
    Username: body.email,
  });

  try {
    await client.send(command);
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}