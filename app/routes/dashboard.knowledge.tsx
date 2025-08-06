import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Knowledge Browser | Knowledge Server" }];
};

export default function Knowledge() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Browser</h1>
        <p className="mt-2 text-gray-600">
          Explore functions, models, patterns, and domain knowledge across all projects
        </p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Search knowledge base..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Filters</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Type
                </label>
                <div className="mt-1 space-y-1">
                  {['Functions', 'Models', 'Patterns', 'Domain'].map((type) => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Project
                </label>
                <div className="mt-1">
                  <select className="block w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500">
                    <option>All Projects</option>
                    {/* TODO: Replace with actual projects */}
                    <option>RMWM</option>
                    <option>CryptoAutotrader</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white shadow rounded-lg">
            <div className="p-6">
              <div className="text-center text-gray-500">
                {/* TODO: Replace with actual knowledge list */}
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No knowledge entries</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Import data from your projects to start building the knowledge base.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}