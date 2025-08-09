import type { SecurityContext } from "~/models/neptune/types";
import { getSession } from "~/sessions.server";
import { getUserIdFromAccessToken } from "~/aws/cognito/getUserIdFromAccessToken";

/**
 * Extract security context from an authenticated request
 * This should be used in handlers that are wrapped with apiLoaderWithUserAuth
 */
export async function getSecurityContextFromRequest(request: Request): Promise<SecurityContext> {
  const session = await getSession(request.headers.get("Cookie"));
  const accessToken = session.get("accessToken");
  
  if (!accessToken) {
    throw new Error("No access token found in session");
  }
  
  try {
    const userId = await getUserIdFromAccessToken(accessToken);
    
    // TODO: Get tenant and team information from user profile or database
    // For now, use defaults
    const tenantId = "default-tenant";
    const teamIds: string[] = [];
    
    return {
      tenantId,
      userId,
      teamIds,
      accessLevels: ["write" as const], // TODO: Get from user roles
      isAdmin: false, // TODO: Check admin role
    };
  } catch (error) {
    throw new Error("Failed to validate access token");
  }
}

/**
 * Security context for unauthenticated/public endpoints
 * Use this only for truly public endpoints
 */
export function getPublicSecurityContext(): SecurityContext {
  return {
    tenantId: "public",
    userId: "anonymous",
    teamIds: [],
    accessLevels: ["read" as const],
    isAdmin: false,
  };
}

/**
 * Extract userId from context (for handlers using apiLoaderWithUserAuth)
 * The middleware injects userId into the loader context
 */
export function getUserIdFromContext(context: any): string | null {
  return context?.userId || null;
}

/**
 * Build security context from userId (for use with middleware pattern)
 */
export async function buildSecurityContext(userId: string): Promise<SecurityContext> {
  // TODO: Load user's tenant and team information from database
  return {
    tenantId: "default-tenant",
    userId,
    teamIds: [],
    accessLevels: ["write" as const],
    isAdmin: false,
  };
}