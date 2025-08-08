import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import type { ActionFunctionArgs } from "react-router";
import { getRegion, getUserPoolClientId } from '~/env';
import { commitSession, getSession } from "~/sessions.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Username and password are required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // Authenticate with Cognito (same as login.tsx)
    const client = new CognitoIdentityProviderClient({ region: getRegion() });
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: getUserPoolClientId(),
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });
    
    const result = await client.send(command);
    
    if (!result.AuthenticationResult?.AccessToken) {
      throw new Error('Authentication failed - no access token received');
    }

    // Create session with access token (same as login.tsx)
    const session = await getSession();
    session.set('accessToken', result.AuthenticationResult.AccessToken);

    // Commit session and get cookie
    const cookieHeader = await commitSession(session);

    // Return success with the session cookie
    return new Response(
      JSON.stringify({
        success: true,
        message: "Authentication successful",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookieHeader,
        },
      }
    );
  } catch (error) {
    console.error("API authentication error:", error);
    
    // Extract error message similar to login.tsx
    const errorMessage = (error as Error).message.split(':')[1]?.trim() || 
                        (error as Error).message || 
                        'Authentication failed';
    
    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};