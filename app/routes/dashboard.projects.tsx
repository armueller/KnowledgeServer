import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Projects | Knowledge Server" }];
};

export default function Projects() {
  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-2 text-gray-600">
            Manage and explore knowledge across your project ecosystem
          </p>
        </div>
        <button className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors">
          Add Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* TODO: Replace with actual project data */}
        {[
          {
            name: "RMWM",
            description: "RM Wealth Manager - Full-stack trading application",
            technology: "React Router v7, AWS, DynamoDB",
            functions: 129,
            models: 33,
            patterns: 24
          },
          {
            name: "CryptoAutotrader",
            description: "Automated cryptocurrency trading system",
            technology: "Node.js, AWS Lambda, DynamoDB",
            functions: 45,
            models: 12,
            patterns: 8
          }
        ].map((project) => (
          <div key={project.name} className="bg-white shadow rounded-lg overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{project.name}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Active
                </span>
              </div>
              
              <p className="mt-2 text-sm text-gray-600">{project.description}</p>
              
              <div className="mt-4">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                  Technology Stack
                </p>
                <p className="mt-1 text-sm text-gray-700">{project.technology}</p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{project.functions}</p>
                  <p className="text-xs text-gray-500">Functions</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{project.models}</p>
                  <p className="text-xs text-gray-500">Models</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-gray-900">{project.patterns}</p>
                  <p className="text-xs text-gray-500">Patterns</p>
                </div>
              </div>

              <div className="mt-6 flex space-x-2">
                <button className="flex-1 bg-primary-600 text-white px-3 py-2 text-sm rounded-md hover:bg-primary-700 transition-colors">
                  Explore
                </button>
                <button className="flex-1 bg-white text-primary-600 px-3 py-2 text-sm rounded-md border border-primary-600 hover:bg-primary-50 transition-colors">
                  Sync
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Add project card */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors cursor-pointer">
          <div className="text-center p-6">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">Add Project</h3>
            <p className="mt-1 text-sm text-gray-500">
              Import knowledge from a new project
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}