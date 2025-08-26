import fetch, { RequestInit } from 'node-fetch';
import { config } from '../config.js';
import { logger } from './logger.js';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  params?: Record<string, any>;
}

export class KnowledgeAPIClient {
  private sessionCookie?: string;
  private baseUrl: string;
  private username: string;
  private password: string;

  constructor() {
    this.baseUrl = config.api.url;
    this.username = config.api.username;
    this.password = config.api.password;
  }

  /**
   * Authenticate with the API and store session cookie
   */
  async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie;
        logger.info('Successfully authenticated with KnowledgeServer API');
      } else {
        throw new Error('No session cookie received');
      }
    } catch (error) {
      logger.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated request to the API
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    // Ensure we're authenticated
    if (!this.sessionCookie) {
      await this.authenticate();
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters if provided
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)));
          } else {
            url.searchParams.append(key, String(value));
          }
        }
      });
    }

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Cookie': this.sessionCookie || '',
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= config.api.retryAttempts; attempt++) {
      try {
        const response = await fetch(url.toString(), requestOptions);

        // Handle 401 - try to re-authenticate once
        if (response.status === 401 && attempt === 1) {
          logger.info('Session expired, re-authenticating...');
          await this.authenticate();
          requestOptions.headers = {
            ...requestOptions.headers,
            'Cookie': this.sessionCookie || '',
          };
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data as T;

      } catch (error) {
        lastError = error as Error;
        logger.warn(`Request attempt ${attempt} failed:`, error);
        
        if (attempt < config.api.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Search for knowledge vertices using advanced search
   * Note: type parameter here refers to search type, not vertex type
   */
  async searchKnowledge(params: {
    searchType: 'domain' | 'tag' | 'project' | 'traversal' | 'function_dependencies';
    domain?: string;
    domainMatch?: 'exact' | 'partial' | 'regex';
    tag?: string;
    tagMatch?: 'exact' | 'partial' | 'regex';
    project?: string;
    startId?: string;  // For traversal
    depth?: number;    // For traversal
    limit?: number;
    offset?: number;
  }) {
    // Map searchType to API's type parameter
    const apiParams = {
      type: params.searchType,
      ...params,
    };
    // Create a new object without searchType
    const { searchType: _, ...cleanParams } = apiParams;
    
    return this.request('/search/advanced', {
      method: 'GET',
      params: cleanParams,
    });
  }

  /**
   * List knowledge vertices with optional filters
   */
  async listVertices(params?: {
    type?: string;
    domain?: string;
    project?: string;
    name?: string;
    nameMatch?: 'exact' | 'partial' | 'regex';
    filePath?: string;
    filePathMatch?: 'exact' | 'partial' | 'regex';
    limit?: number;
    offset?: number;
  }) {
    return this.request('/knowledge', {
      method: 'GET',
      params: { op: 'list', ...params },
    });
  }

  /**
   * Get a specific vertex by ID
   */
  async getVertex(id: string) {
    return this.request('/knowledge', {
      method: 'GET',
      params: { op: 'get', id },
    });
  }

  /**
   * Create a new vertex
   */
  async createVertex(data: any) {
    return this.request('/knowledge', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing vertex
   */
  async updateVertex(id: string, updates: any) {
    return this.request(`/knowledge`, {
      method: 'PUT',
      params: { id },
      body: updates,
    });
  }

  /**
   * Delete a vertex
   */
  async deleteVertex(id: string) {
    return this.request(`/knowledge`, {
      method: 'DELETE',
      params: { id },
    });
  }

  /**
   * Create an edge between vertices
   */
  async createEdge(data: {
    fromVertexId: string;
    toVertexId: string;
    type: string;
    visibility?: string;
    metadata?: any;
  }) {
    return this.request('/relationships', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Get edges from a vertex
   */
  async getEdges(vertexId: string, edgeTypes?: string[]) {
    return this.request('/relationships', {
      method: 'GET',
      params: { 
        op: 'from', 
        from: vertexId,
        edgeTypes: edgeTypes?.join(',')  // API expects comma-separated string
      },
    });
  }

  /**
   * Traverse graph from a vertex
   */
  async traverseGraph(params: {
    from: string;
    depth?: number;
    edgeTypes?: string[];
  }) {
    return this.request('/relationships', {
      method: 'GET',
      params: {
        op: 'traverse',
        from: params.from,
        depth: params.depth,
        edgeTypes: params.edgeTypes?.join(','),
      },
    });
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies(params: {
    vertexId: string;
    direction?: string;
    maxDepth?: number;
    includeIndirect?: boolean;
  }) {
    return this.request('/analysis', {
      method: 'GET',
      params: { type: 'dependency', ...params },
    });
  }

  /**
   * Analyze impact
   */
  async analyzeImpact(params: {
    vertexId: string;
    changeType?: string;
    maxDepth?: number;
  }) {
    return this.request('/analysis', {
      method: 'GET',
      params: { type: 'impact', ...params },
    });
  }

  /**
   * Detect patterns
   */
  async detectPatterns(params: {
    domain?: string;
    project?: string;
    minOccurrences?: number;
  }) {
    return this.request('/analysis', {
      method: 'GET',
      params: { type: 'pattern', ...params },
    });
  }
}

// Export singleton instance
export const apiClient = new KnowledgeAPIClient();