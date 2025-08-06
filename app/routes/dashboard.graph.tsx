import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [{ title: "Graph View | Knowledge Server" }];
};

export default function GraphView() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Graph</h1>
        <p className="mt-2 text-gray-600">
          Interactive visualization of relationships between functions, models, and patterns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Graph Controls</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Focus Project
                  </label>
                  <select className="block w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500">
                    <option>All Projects</option>
                    <option>RMWM</option>
                    <option>CryptoAutotrader</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Node Types
                  </label>
                  <div className="space-y-1">
                    {['Functions', 'Models', 'Patterns', 'Projects'].map((type) => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Layout Algorithm
                  </label>
                  <select className="block w-full text-sm border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500">
                    <option>Force-directed</option>
                    <option>Hierarchical</option>
                    <option>Circular</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-xs font-medium text-gray-700 mb-2">Legend</h4>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-xs text-gray-600">Functions</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                  <span className="text-xs text-gray-600">Models</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                  <span className="text-xs text-gray-600">Patterns</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                  <span className="text-xs text-gray-600">Projects</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white shadow rounded-lg h-96 lg:h-[600px]">
            <div className="h-full flex items-center justify-center text-gray-500">
              {/* TODO: Replace with D3.js graph visualization */}
              <div className="text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Graph Visualization</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Interactive knowledge graph will appear here once data is imported.
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Powered by D3.js and Neo4j
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}