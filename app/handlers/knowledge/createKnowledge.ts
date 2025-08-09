import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import { buildSecurityContext } from "../utils/auth";
import { SCHEMA_VERSION } from "~/models/neptune/types";
import type {
  FunctionVertex,
  SystemVertex,
  ModelVertex,
  PatternVertex,
  ConceptVertex,
  KnowledgeVertex,
} from "~/models/neptune/types";

/**
 * Handle creating new knowledge entries
 */
export async function createKnowledge(
  request: Request,
  context: { userId: string }
): Promise<Response> {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.type || !data.name) {
      return Response.json(
        { error: "type and name are required fields" },
        { status: 400 }
      );
    }
    
    const securityContext = await buildSecurityContext(context.userId);
    const repo = new KnowledgeGraphRepository(securityContext);
    
    let newVertex: KnowledgeVertex;
    
    // Common properties for all vertex types
    const commonProps = {
      name: data.name,
      description: data.description || "",
      project: data.project || "unknown",
      domain: data.domain || "general",
      visibility: data.visibility || "private",
      accessLevel: data.accessLevel || "write",
      tags: data.tags || [],
      keywords: data.keywords || [],
      status: data.status || "active",
      confidence: data.confidence || 1.0,
      version: data.version || "1.0.0",
      userId: context.userId,
      schemaVersion: SCHEMA_VERSION,
    };
    
    switch (data.type) {
      case "Function":
        newVertex = await repo.vertices.createVertex<FunctionVertex>({
          type: "Function",
          ...commonProps,
          filePath: data.filePath || "",
          signature: data.signature || "",
          isAsync: data.isAsync || false,
          isPure: data.isPure || false,
          lineStart: data.lineStart || 0,
          lineEnd: data.lineEnd || 0,
          returnType: data.returnType || "void",
          parameters: data.parameters || [],
          sideEffects: data.sideEffects || [],
        });
        break;
        
      case "System":
        newVertex = await repo.vertices.createVertex<SystemVertex>({
          type: "System",
          ...commonProps,
          systemDomain: data.systemDomain || data.domain || "general",
          boundaries: data.boundaries || [],
          interfaces: data.interfaces || [],
          contracts: data.contracts || [],
        });
        break;
        
      case "Model":
        newVertex = await repo.vertices.createVertex<ModelVertex>({
          type: "Model",
          ...commonProps,
          filePath: data.filePath || "",
          lineStart: data.lineStart || 0,
          lineEnd: data.lineEnd || 0,
          modelType: data.modelType || "interface",
          properties: data.properties || [],
          methods: data.methods || [],
          extends: data.extends,
          implements: data.implements,
        });
        break;
        
      case "Pattern":
        newVertex = await repo.vertices.createVertex<PatternVertex>({
          type: "Pattern",
          ...commonProps,
          patternType: data.patternType || "design",
          problem: data.problem || "",
          solution: data.solution || "",
          examples: data.examples || [],
          antiPatterns: data.antiPatterns || [],
        });
        break;
        
      case "Concept":
        newVertex = await repo.vertices.createVertex<ConceptVertex>({
          type: "Concept",
          ...commonProps,
          conceptType: data.conceptType || "general",
          definition: data.definition || "",
          examples: data.examples || [],
          relationships: data.relationships || [],
          synonyms: data.synonyms || [],
        });
        break;
        
      default:
        return Response.json(
          { error: `Unsupported knowledge type: ${data.type}` },
          { status: 400 }
        );
    }
    
    return Response.json({
      success: true,
      data: newVertex,
    }, { status: 201 });
    
  } catch (error) {
    console.error("Create knowledge error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}