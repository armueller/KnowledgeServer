import { Outlet } from "react-router";
import { loaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import type { Route } from "./+types/dashboard";

export const loader = loaderWithUserAuth(async ({ context }: Route.LoaderArgs & { context: { userId: string } }) => {
  // TODO: Add Neo4j health check
  return { userId: context.userId };
});

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex-shrink-0 flex items-center space-x-3">
                <img alt="Knowledge Server" src="/knowledge-server-logo-small.png" className="h-8 w-auto" />
                <h1 className="text-xl font-semibold text-gray-900">
                  Knowledge Server
                </h1>
              </div>
              <div className="flex space-x-8">
                <a
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Dashboard
                </a>
                <a
                  href="/dashboard/knowledge"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Knowledge
                </a>
                <a
                  href="/dashboard/projects"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Projects
                </a>
                <a
                  href="/dashboard/graph"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
                >
                  Graph View
                </a>
              </div>
            </div>
            <div className="flex items-center">
              <a
                href="/logout"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium"
              >
                Logout
              </a>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}