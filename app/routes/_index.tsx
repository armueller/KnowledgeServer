import type { MetaFunction } from "react-router";
import { redirect } from "react-router";
import { getSession } from "~/sessions.server";
import type { Route } from "./+types/_index";

export const meta: MetaFunction = () => {
  return [
    { title: "Knowledge Server" },
    { name: "description", content: "Neo4j-based contextual knowledge management across projects" },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get('Cookie'));

  if (session.has('accessToken')) {
    return redirect('/dashboard');
  } else {
    return redirect('/login');
  }
}

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Knowledge Server
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Neo4j-powered contextual knowledge management for all your projects
          </p>
          <div className="flex justify-center space-x-4">
            <a
              href="/dashboard"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Go to Dashboard
            </a>
            <a
              href="/dashboard/knowledge"
              className="bg-white text-primary-600 px-6 py-3 rounded-lg font-medium border border-primary-600 hover:bg-primary-50 transition-colors"
            >
              Browse Knowledge
            </a>
          </div>
        </div>
        
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Graph Database
            </h3>
            <p className="text-gray-600">
              Leverage Neo4j's powerful graph capabilities to model relationships between functions, models, and patterns across all projects.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              MCP Integration
            </h3>
            <p className="text-gray-600">
              Seamless integration with Claude through the Model Context Protocol for intelligent knowledge discovery and analysis.
            </p>
          </div>
          
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Cross-Project Context
            </h3>
            <p className="text-gray-600">
              Unified view of architectural patterns, code relationships, and domain knowledge across your entire project ecosystem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}