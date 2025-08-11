import { 
  AnalyzeDependenciesSchema,
  AnalyzeImpactSchema,
  DetectPatternsSchema,
  type AnalyzeDependencies,
  type AnalyzeImpact,
  type DetectPatterns,
} from '../types/tools.js';
import { apiClient } from '../utils/api-client.js';
import { cacheManager } from '../utils/cache.js';
import { logger } from '../utils/logger.js';

/**
 * Analyze dependencies for a vertex
 */
export async function analyzeDependencies(params: AnalyzeDependencies) {
  const cacheKey = cacheManager.generateKey('analyzeDependencies', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const queryParams: any = {
      type: 'dependency',
      vertexId: params.vertexId,
      direction: params.direction || 'both',
      maxDepth: params.maxDepth || 5,
      includeIndirect: params.includeIndirect !== false,
    };
    
    if (params.edgeTypes && params.edgeTypes.length > 0) {
      queryParams.edgeTypes = params.edgeTypes.join(',');
    }

    const result = await apiClient.request('/api/analysis', {
      params: queryParams,
    });

    // Format dependency analysis for Claude
    const formatted = {
      vertex: params.vertexId,
      direction: params.direction || 'both',
      summary: {
        totalDependencies: result.dependencies?.length || 0,
        directDependencies: result.directCount || 0,
        indirectDependencies: result.indirectCount || 0,
        circularDependencies: result.circular || [],
        maxDepthReached: result.maxDepth || 0,
      },
      dependencies: result.dependencies || [],
      circular: result.circular || [],
      warnings: result.warnings || [],
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('analyzeDependencies failed:', error);
    throw new Error(`Failed to analyze dependencies: ${error}`);
  }
}

/**
 * Analyze the impact of changes to a vertex
 */
export async function analyzeImpact(params: AnalyzeImpact) {
  const cacheKey = cacheManager.generateKey('analyzeImpact', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const queryParams = {
      type: 'impact',
      vertexId: params.vertexId,
      changeType: params.changeType || 'modify',
      maxDepth: params.maxDepth || 3,
      includeSeverity: params.includeSeverity !== false,
    };

    const result = await apiClient.request('/api/analysis', {
      params: queryParams,
    });

    // Format impact analysis with actionable insights
    const formatted = {
      vertex: params.vertexId,
      changeType: params.changeType || 'modify',
      summary: {
        totalImpacted: result.impactedVertices?.length || 0,
        highSeverity: result.severityBreakdown?.high || 0,
        mediumSeverity: result.severityBreakdown?.medium || 0,
        lowSeverity: result.severityBreakdown?.low || 0,
        recommendation: result.recommendation || 'Proceed with caution',
      },
      impactedVertices: result.impactedVertices || [],
      severityBreakdown: result.severityBreakdown || {},
      recommendations: result.recommendations || [],
      risks: result.risks || [],
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('analyzeImpact failed:', error);
    throw new Error(`Failed to analyze impact: ${error}`);
  }
}

/**
 * Detect patterns in the codebase (CRITICAL for pit of success)
 */
export async function detectPatterns(params: DetectPatterns) {
  const cacheKey = cacheManager.generateKey('detectPatterns', params);
  const cached = cacheManager.get(cacheKey);
  if (cached) return cached;

  try {
    const queryParams: any = {
      type: 'pattern',
      minOccurrences: params.minOccurrences || 2,
      similarity: params.similarity || 0.8,
      limit: params.limit || 20,
    };
    
    // Add optional filters
    if (params.domain) queryParams.domain = params.domain;
    if (params.project) queryParams.project = params.project;
    if (params.patternType) queryParams.patternType = params.patternType;

    const result = await apiClient.request('/api/analysis', {
      params: queryParams,
    });

    // Format patterns with examples for easy understanding
    const formatted = {
      filters: {
        domain: params.domain,
        project: params.project,
        patternType: params.patternType,
      },
      summary: {
        totalPatterns: result.patterns?.length || 0,
        architecturalPatterns: result.patternBreakdown?.architectural || 0,
        designPatterns: result.patternBreakdown?.design || 0,
        antiPatterns: result.patternBreakdown?.antiPattern || 0,
      },
      patterns: (result.patterns || []).map((pattern: any) => ({
        ...pattern,
        // Add helpful context for Claude
        usage: `Found in ${pattern.occurrences || 0} places`,
        recommendation: pattern.isAntiPattern 
          ? `⚠️ Anti-pattern detected: ${pattern.recommendation || 'Consider refactoring'}`
          : `✅ Good pattern: ${pattern.description || 'Follow this pattern'}`,
        examples: pattern.examples || [],
      })),
      antiPatterns: result.antiPatterns || [],
      recommendations: result.recommendations || [],
    };

    cacheManager.set(cacheKey, formatted);
    return formatted;
  } catch (error) {
    logger.error('detectPatterns failed:', error);
    throw new Error(`Failed to detect patterns: ${error}`);
  }
}

// Export tool definitions for MCP server registration
export const analysisTools = {
  analyze_dependencies: {
    description: 'Analyze forward, reverse, or bidirectional dependencies of a vertex, including circular dependency detection',
    inputSchema: AnalyzeDependenciesSchema,
    handler: analyzeDependencies,
  },
  analyze_impact: {
    description: 'Analyze the impact of modifying, deleting, or deprecating a vertex, with severity assessment',
    inputSchema: AnalyzeImpactSchema,
    handler: analyzeImpact,
  },
  detect_patterns: {
    description: 'Detect architectural patterns, design patterns, and anti-patterns in the codebase (CRITICAL for following established conventions)',
    inputSchema: DetectPatternsSchema,
    handler: detectPatterns,
  },
};