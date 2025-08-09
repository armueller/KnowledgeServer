import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { parsePatternParams } from "../utils/security";

interface DetectedPattern {
  type: string;
  description: string;
  occurrences: any[];
  count: number;
  confidence: number;
  examples: string[];
  recommendations?: string[];
}

interface PatternDetectionResult {
  query: {
    domain?: string;
    project?: string;
    patternType?: string;
  };
  patterns: DetectedPattern[];
  stats: {
    totalPatterns: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    uniqueTypes: string[];
  };
}

/**
 * Detect patterns in the knowledge graph
 * Identifies common architectural patterns, anti-patterns, and recurring structures
 */
export async function patternDetection(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  const params = parsePatternParams(request);

  try {
    const securityContext = await buildSecurityContext(context.userId);
    const repository = new KnowledgeGraphRepository(securityContext);
    
    // Detect patterns
    const detectedPatterns = await repository.detectPatterns(
      params.domain || undefined,
      params.project || undefined,
      params.minOccurrences
    );

    // Enhance patterns with additional analysis
    const patterns: DetectedPattern[] = [];
    
    for (const pattern of detectedPatterns) {
      const enhanced = await enhancePattern(
        pattern,
        params.similarity,
        repository
      );
      
      if (enhanced.confidence >= params.similarity) {
        patterns.push(enhanced);
      }
    }

    // Sort by confidence and limit
    patterns.sort((a, b) => b.confidence - a.confidence);
    const limitedPatterns = patterns.slice(0, params.limit);

    // Calculate statistics
    const stats = {
      totalPatterns: limitedPatterns.length,
      highConfidence: limitedPatterns.filter(p => p.confidence >= 0.9).length,
      mediumConfidence: limitedPatterns.filter(p => p.confidence >= 0.7 && p.confidence < 0.9).length,
      lowConfidence: limitedPatterns.filter(p => p.confidence < 0.7).length,
      uniqueTypes: [...new Set(limitedPatterns.map(p => p.type))],
    };

    const result: PatternDetectionResult = {
      query: {
        domain: params.domain || undefined,
        project: params.project || undefined,
        patternType: params.patternType || undefined,
      },
      patterns: limitedPatterns,
      stats,
    };

    return Response.json({
      success: true,
      analysis: "pattern_detection",
      params,
      result,
    });

  } catch (error) {
    console.error("Pattern detection error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Enhance a detected pattern with additional analysis
 */
async function enhancePattern(
  pattern: any,
  similarityThreshold: number,
  repository: KnowledgeGraphRepository
): Promise<DetectedPattern> {
  const enhanced: DetectedPattern = {
    type: pattern.type,
    description: pattern.description,
    occurrences: pattern.occurrences || [],
    count: pattern.count || pattern.occurrences?.length || 0,
    confidence: calculateConfidence(pattern),
    examples: [],
    recommendations: [],
  };

  // Extract examples
  if (pattern.occurrences && pattern.occurrences.length > 0) {
    enhanced.examples = pattern.occurrences
      .slice(0, 3)
      .map((occ: any) => occ.name || occ.id);
  }

  // Generate pattern-specific recommendations
  enhanced.recommendations = generatePatternRecommendations(pattern.type, enhanced);

  return enhanced;
}

/**
 * Calculate confidence score for a pattern
 */
function calculateConfidence(pattern: any): number {
  let confidence = 0.5; // Base confidence

  // More occurrences increase confidence
  if (pattern.count > 10) confidence += 0.3;
  else if (pattern.count > 5) confidence += 0.2;
  else if (pattern.count > 2) confidence += 0.1;

  // Known pattern types have higher confidence
  const knownPatterns = [
    'Hub Function',
    'Circular Dependencies',
    'Layered Architecture',
    'God Object',
    'Singleton',
    'Factory Pattern',
  ];
  
  if (knownPatterns.includes(pattern.type)) {
    confidence += 0.2;
  }

  // Cap at 1.0
  return Math.min(confidence, 1.0);
}

/**
 * Generate recommendations for detected patterns
 */
function generatePatternRecommendations(
  patternType: string,
  pattern: DetectedPattern
): string[] {
  const recommendations: string[] = [];

  switch (patternType) {
    case 'Hub Function':
      recommendations.push(
        "Consider breaking down hub functions into smaller, focused functions",
        "Evaluate if this represents a facade pattern or needs refactoring",
        "Document the orchestration logic clearly"
      );
      break;

    case 'Circular Dependencies':
      recommendations.push(
        "⚠️ Circular dependencies detected - refactor to break cycles",
        "Consider introducing an abstraction layer or interface",
        "Use dependency injection to decouple components"
      );
      break;

    case 'Layered Architecture':
      recommendations.push(
        "Good architectural pattern detected",
        "Ensure layer boundaries are well-defined",
        "Document layer responsibilities and interfaces"
      );
      break;

    case 'God Object':
      recommendations.push(
        "⚠️ Anti-pattern: God Object detected",
        "Break down into smaller, single-responsibility components",
        "Apply SOLID principles to refactor"
      );
      break;

    case 'Deep Dependency Chain':
      recommendations.push(
        "Consider flattening deep dependency hierarchies",
        "Evaluate if intermediate layers add value",
        "Look for opportunities to reduce coupling"
      );
      break;

    case 'Isolated Component':
      recommendations.push(
        "Component has no dependencies or dependents",
        "Verify if this component is still in use",
        "Consider removing if obsolete"
      );
      break;

    default:
      if (pattern.count > 5) {
        recommendations.push(
          `Pattern occurs ${pattern.count} times - consider standardizing`,
          "Document this pattern for team awareness"
        );
      }
  }

  return recommendations;
}