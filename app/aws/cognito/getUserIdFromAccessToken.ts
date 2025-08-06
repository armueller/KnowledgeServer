import { CognitoIdentityProviderClient, GetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getRegion } from '~/env';

/**
 * Get user ID from Cognito access token
 */
export async function getUserIdFromAccessToken(accessToken: string) {
  const client = new CognitoIdentityProviderClient({ region: getRegion() });
  const command = new GetUserCommand({
    AccessToken: accessToken,
  });
  const result = await client.send(command);
  const userId = result.Username;
  if (!userId) {
    throw new Error('User not found');
  }
  return userId;
}