import "server-only";

import { containsSensitiveResearchData } from "@/lib/research/discovery/query-plan";
import type { ResearchTargetResolver } from "@/lib/research/discovery/types";
import type { Phase2ResearchOptions } from "@/lib/research/orchestration";
import {
  researchRequestSchema,
  type ResearchResult,
} from "@/lib/research/contracts";
import type {
  ResearchCatalog,
  ResearchCatalogProgram,
  ResearchCatalogUniversity,
} from "@/lib/research/catalog/schema";
import { composeResearchDossier } from "./compose-dossier";
import {
  canonicalizeResearchModeCategories,
  publicResearchTransportErrorSchema,
  researchModeRequestSchema,
  researchModeResponseSchema,
  type PublicResearchTransportError,
} from "./public-contracts";
import { readBoundedJsonRequest } from "./read-bounded-request";

export const RESEARCH_MODE_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

export type ResearchHandlerDependencies = {
  catalog: ResearchCatalog;
  targetResolver: ResearchTargetResolver;
  runResearch: (
    input: unknown,
    options: Phase2ResearchOptions,
  ) => Promise<ResearchResult>;
};

const transportErrors: Record<
  PublicResearchTransportError["code"],
  { status: number; message: string }
> = {
  "invalid-content-type": {
    status: 415,
    message: "Research requests must use JSON content.",
  },
  "request-too-large": {
    status: 413,
    message: "The research request is too large.",
  },
  "invalid-json": {
    status: 400,
    message: "The research request body must be valid UTF-8 JSON.",
  },
  "invalid-request": {
    status: 400,
    message: "The research request is invalid.",
  },
  "unsupported-target": {
    status: 404,
    message: "The selected university or program is not supported.",
  },
  "sensitive-input": {
    status: 400,
    message: "Research questions must contain public information only.",
  },
  "forbidden-origin": {
    status: 403,
    message: "Cross-origin research requests are not allowed.",
  },
  "internal-error": {
    status: 500,
    message: "UniProof could not complete this research request.",
  },
};

function rawJsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function jsonResponse(envelope: unknown, status: number): Response {
  const validated = researchModeResponseSchema.parse(envelope);
  const body = JSON.stringify(validated);
  if (Buffer.byteLength(body, "utf8") > RESEARCH_MODE_MAX_RESPONSE_BYTES) {
    return errorResponse("internal-error");
  }
  return rawJsonResponse(body, status);
}

function errorResponse(code: PublicResearchTransportError["code"], statusOverride?: number): Response {
  const error = publicResearchTransportErrorSchema.parse({
    code,
    message: transportErrors[code].message,
  });
  return jsonResponse(
    { ok: false, error },
    statusOverride ?? transportErrors[code].status,
  );
}

function isAllowedResearchOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function createResearchPostHandler(
  dependencies: ResearchHandlerDependencies,
): (request: Request) => Promise<Response> {
  const universities = new Map(dependencies.catalog.universities.map((item) => [item.id, item]));
  const programs = new Map(dependencies.catalog.programs.map((item) => [item.id, item]));

  return async function postResearch(request: Request): Promise<Response> {
    try {
      if (!isAllowedResearchOrigin(request)) return errorResponse("forbidden-origin");

      const body = await readBoundedJsonRequest(request);
      if (!body.ok) {
        return errorResponse(body.code);
      }

      const parsedRequest = researchModeRequestSchema.safeParse(body.value);
      if (!parsedRequest.success) return errorResponse("invalid-request");
      const researchRequest = parsedRequest.data;

      const university = universities.get(researchRequest.universityId);
      if (university === undefined) return errorResponse("unsupported-target");

      let program: ResearchCatalogProgram | undefined;
      if (researchRequest.programId !== undefined) {
        program = programs.get(researchRequest.programId);
        if (program === undefined) return errorResponse("unsupported-target");
        if (program.universityId !== university.id) {
          return errorResponse("unsupported-target", 400);
        }
      }

      const callerFreeText = [
        researchRequest.question,
        researchRequest.intake,
        researchRequest.academicYear,
      ].filter((value): value is string => value !== undefined).join(" ");
      if (containsSensitiveResearchData(callerFreeText)) {
        return errorResponse("sensitive-input");
      }
      if (request.signal.aborted) return errorResponse("invalid-request");

      const phase2Request = {
        target: {
          university: { id: researchRequest.universityId },
          ...(researchRequest.programId === undefined ? {} : {
            program: {
              id: researchRequest.programId,
              universityId: researchRequest.universityId,
            },
          }),
        },
        categories: researchRequest.categories,
        ...(researchRequest.question === undefined ? {} : { question: researchRequest.question }),
        ...(researchRequest.intake === undefined ? {} : { intake: researchRequest.intake }),
        ...(researchRequest.academicYear === undefined ? {} : { academicYear: researchRequest.academicYear }),
      };
      const validatedPhase2Request = researchRequestSchema.parse(phase2Request);

      const result = await dependencies.runResearch(validatedPhase2Request, {
        signal: request.signal,
        discovery: {
          targetResolver: dependencies.targetResolver,
        },
      });

      const resultCategories = canonicalizeResearchModeCategories([
        ...result.run.processedCategories,
        ...result.run.unprocessedCategories,
      ]);
      if (
        resultCategories.length !== researchRequest.categories.length ||
        resultCategories.some((category, index) => category !== researchRequest.categories[index])
      ) {
        throw new Error("research result category partition does not match the request");
      }

      const selectedUniversity: ResearchCatalogUniversity = university;
      const selectedProgram: ResearchCatalogProgram | undefined = program;
      const dossier = composeResearchDossier(result, {
        university: selectedUniversity,
        ...(selectedProgram === undefined ? {} : { program: selectedProgram }),
      });
      const envelope = { ok: true as const, dossier };
      const validatedEnvelope = researchModeResponseSchema.parse(envelope);
      const serialized = JSON.stringify(validatedEnvelope);
      if (Buffer.byteLength(serialized, "utf8") > RESEARCH_MODE_MAX_RESPONSE_BYTES) {
        return errorResponse("internal-error");
      }
      return rawJsonResponse(serialized, 200);
    } catch {
      if (request.signal.aborted) {
        throw new Error("research request was cancelled before a response could be produced");
      }
      return errorResponse("internal-error");
    }
  };
}
