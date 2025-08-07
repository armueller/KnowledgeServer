import type { LoaderFunctionArgs } from "react-router";
import { getNeptuneHealthStatus } from "~/services/neptune/connection";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const healthStatus = await getNeptuneHealthStatus();
    
    const response = {
      status: healthStatus.connected ? 'healthy' : 'unhealthy',
      service: 'neptune',
      timestamp: new Date().toISOString(),
      details: {
        connected: healthStatus.connected,
        writeEndpoint: healthStatus.writeEndpoint,
        readEndpoint: healthStatus.readEndpoint,
        vertexCount: healthStatus.vertexCount || 0,
        edgeCount: healthStatus.edgeCount || 0,
        error: healthStatus.error,
      }
    };

    return Response.json(response, {
      status: healthStatus.connected ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error('Neptune health check failed:', error);
    
    return Response.json({
      status: 'error',
      service: 'neptune',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    }, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}