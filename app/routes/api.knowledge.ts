import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { apiLoaderWithUserAuth } from "~/middleware/loaderWithUserAuth";
import { apiActionWithUserAuth } from "~/middleware/actionWithUserAuth";
import { KnowledgeGraphRepository } from "~/services/neptune/repository";
import type { 
  SecurityContext, 
  FunctionVertex, 
  SystemVertex,
  ModelVertex,
  PatternVertex,
  ConceptVertex,
  KnowledgeVertex 
} from "~/models/neptune/types";

// Helper function to create security context from authenticated user
const createSecurityContext = (userId: string): SecurityContext => ({
  tenantId: "default-tenant", // TODO: Get from user profile
  userId,
  teamIds: ["default-team"], // TODO: Get from user profile  
  accessLevels: ["read", "write"],
  isAdmin: false, // TODO: Get from user profile
});

export const loader = apiLoaderWithUserAuth(async ({ request, context }: LoaderFunctionArgs & { context: { userId: string } }) => {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  // Extract query parameters
  const operation = searchParams.get("op") || "list";
  const type = searchParams.get("type");
  const project = searchParams.get("project");
  const id = searchParams.get("id");
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const securityContext = createSecurityContext(context.userId);
  const repo = new KnowledgeGraphRepository(securityContext);

  try {
    switch (operation) {
      case "get":
        if (!id) {
          return Response.json({ error: "ID required for get operation" }, { status: 400 });
        }
        const vertex = await repo.vertices.findById(id);
        if (!vertex) {
          return Response.json({ error: "Knowledge entry not found" }, { status: 404 });
        }
        return Response.json({ success: true, data: vertex });

      case "list":
        const filters: any = {};
        if (type) filters.type = type;
        if (project) filters.project = project;
        
        const results = await repo.vertices.query({
          securityContext,
          vertexFilters: filters,
          limit,
          offset,
          orderBy: "updatedAt",
          orderDirection: "DESC",
        });
        
        return Response.json({
          success: true,
          data: results.data,
          pagination: {
            total: results.count,
            limit,
            offset,
            hasMore: results.hasMore,
          },
        });

      case "search":
        if (!query) {
          return Response.json({ error: "Query parameter 'q' required for search" }, { status: 400 });
        }
        
        // TODO: Implement full-text search - for now search by name/description contains
        const searchFilters: any = {};
        if (type && (type === "Function" || type === "System")) {
          searchFilters.type = type;
        }
        
        const searchResults = await repo.vertices.query({
          securityContext,
          vertexFilters: searchFilters,
          limit,
          offset,
        });
        
        // Client-side filtering for now - TODO: Move to Neptune query
        const filtered = searchResults.data.filter(v => 
          v.name.toLowerCase().includes(query.toLowerCase()) ||
          v.description.toLowerCase().includes(query.toLowerCase())
        );
        
        return Response.json({
          success: true,
          data: filtered,
          query,
          total: filtered.length,
        });

      default:
        return Response.json({
          error: `Unknown operation: ${operation}. Use: get, list, search`,
        }, { status: 400 });
    }
  } catch (error) {
    console.error("Knowledge API error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
});

export const action = apiActionWithUserAuth(async ({ request, context }: ActionFunctionArgs & { context: { userId: string } }) => {
  const securityContext = createSecurityContext(context.userId);
  const repo = new KnowledgeGraphRepository(securityContext);

  try {
    if (request.method === "POST") {
      const data = await request.json();
      
      // Validate required fields
      if (!data.type || !data.name) {
        return Response.json({ error: "type and name are required fields" }, { status: 400 });
      }

      let newVertex: KnowledgeVertex;
      
      switch (data.type) {
        case "Function":
          newVertex = await repo.vertices.createVertex<FunctionVertex>({
            type: "Function",
            name: data.name,
            description: data.description || "",
            filePath: data.filePath || "",
            signature: data.signature || "",
            isAsync: data.isAsync || false,
            isPure: data.isPure || false,
            lineStart: data.lineStart || 0,
            lineEnd: data.lineEnd || 0,
            returnType: data.returnType || "void",
            parameters: data.parameters || [],
            sideEffects: data.sideEffects || [],
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
            schemaVersion: "1.0.0",
          });
          break;

        case "System":
          newVertex = await repo.vertices.createVertex<SystemVertex>({
            type: "System",
            name: data.name,
            description: data.description || "",
            systemDomain: data.systemDomain || data.domain || "general",
            boundaries: data.boundaries || [],
            interfaces: data.interfaces || [],
            contracts: data.contracts || [],
            project: data.project || "unknown",
            domain: data.domain || "general",
            visibility: data.visibility || "organization",
            accessLevel: data.accessLevel || "write",
            tags: data.tags || [],
            keywords: data.keywords || [],
            status: data.status || "active",
            confidence: data.confidence || 1.0,
            version: data.version || "1.0.0",
            userId: context.userId,
            schemaVersion: "1.0.0",
          });
          break;

        case "Model":
          newVertex = await repo.vertices.createVertex<ModelVertex>({
            type: "Model",
            name: data.name,
            description: data.description || "",
            filePath: data.filePath || "",
            lineStart: data.lineStart || 0,
            lineEnd: data.lineEnd || 0,
            modelType: data.modelType || "interface",
            properties: data.properties || [],
            methods: data.methods || [],
            extends: data.extends,
            implements: data.implements,
            project: data.project || "unknown",
            domain: data.domain || "code",
            visibility: data.visibility || "private",
            accessLevel: data.accessLevel || "write",
            tags: data.tags || [],
            keywords: data.keywords || [],
            status: data.status || "active",
            confidence: data.confidence || 1.0,
            version: data.version || "1.0.0",
            userId: context.userId,
            schemaVersion: "1.0.0",
          });
          break;

        case "Pattern":
          newVertex = await repo.vertices.createVertex<PatternVertex>({
            type: "Pattern",
            name: data.name,
            description: data.description || "",
            patternType: data.patternType || "design",
            problem: data.problem || "",
            solution: data.solution || "",
            examples: data.examples || [],
            antiPatterns: data.antiPatterns || [],
            project: data.project || "unknown",
            domain: data.domain || "architecture",
            visibility: data.visibility || "private",
            accessLevel: data.accessLevel || "write",
            tags: data.tags || [],
            keywords: data.keywords || [],
            status: data.status || "active",
            confidence: data.confidence || 1.0,
            version: data.version || "1.0.0",
            userId: context.userId,
            schemaVersion: "1.0.0",
          });
          break;

        case "Concept":
          newVertex = await repo.vertices.createVertex<ConceptVertex>({
            type: "Concept",
            name: data.name,
            description: data.description || "",
            conceptType: data.conceptType || "general",
            definition: data.definition || "",
            examples: data.examples || [],
            relationships: data.relationships || [],
            synonyms: data.synonyms || [],
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
            schemaVersion: "1.0.0",
          });
          break;

        default:
          return Response.json({ error: `Unsupported vertex type: ${data.type}` }, { status: 400 });
      }

      return Response.json({
        success: true,
        message: "Knowledge entry created successfully",
        data: newVertex,
      }, { status: 201 });
    }

    if (request.method === "PUT") {
      const data = await request.json();
      
      if (!data.id) {
        return Response.json({ error: "ID required for update" }, { status: 400 });
      }

      const updatedVertex = await repo.vertices.updateVertex(data.id, data);
      if (!updatedVertex) {
        return Response.json({ error: "Knowledge entry not found or insufficient permissions" }, { status: 404 });
      }

      return Response.json({
        success: true,
        message: "Knowledge entry updated successfully",
        data: updatedVertex,
      });
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const id = url.searchParams.get("id");
      
      if (!id) {
        return Response.json({ error: "Missing required parameter: id" }, { status: 400 });
      }
      
      const deleted = await repo.vertices.deleteVertex(id);
      return Response.json({
        success: true,
        message: "Knowledge entry deleted successfully",
        deleted,
      });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    console.error("Knowledge API action error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
});