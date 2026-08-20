import { researchRequestSchema, type ResearchRequest } from "@/lib/research/contracts";
import type {
  ResolvedResearchTarget,
  ResearchTargetResolver,
  TargetResolutionResult,
} from "./types";
import { sameResearchIdentity } from "@/lib/research/identity";
import { hostMatchesOfficialRoot, normalizeOfficialHost } from "@/lib/research/official-host";

function safeHost(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return normalizeOfficialHost(parsed.hostname);
  } catch {
    return undefined;
  }
}

function normalizeRequestTarget(request: ResearchRequest) {
  if (request.target !== undefined) return request.target;
  if (
    request.universityId === undefined &&
    request.universityName === undefined &&
    request.programId === undefined &&
    request.programName === undefined
  ) {
    return undefined;
  }
  return {
    university:
      request.universityId === undefined && request.universityName === undefined
        ? undefined
        : { id: request.universityId, name: request.universityName },
    program:
      request.programId === undefined && request.programName === undefined
        ? undefined
        : { id: request.programId, name: request.programName },
  };
}

export async function resolveResearchTarget(
  input: ResearchRequest | unknown,
  resolver: ResearchTargetResolver = {},
): Promise<TargetResolutionResult> {
  const parsed = researchRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      resolved: false,
      reason: "insufficient-institutional-identity",
      warnings: ["research request failed contract validation"],
    };
  }

  const request = parsed.data;
  const targetInput = normalizeRequestTarget(request);
  const warnings: string[] = [];
  const target: ResolvedResearchTarget = {
    subjectArea: targetInput?.subjectArea,
  };

  if (targetInput === undefined) {
    // A question-only request is a valid topical target, but it has no
    // institutional identity and therefore cannot use direct/ROR fallback.
    if (request.question !== undefined) {
      warnings.push("question-only request has no institutional direct/ROR fallback");
      return { resolved: true, target, warnings };
    }
    return {
      resolved: false,
      reason: "insufficient-institutional-identity",
      warnings: ["no institutional or topical research target was supplied"],
    };
  }

  const suppliedUniversity = targetInput.university;
  const suppliedProgram = targetInput.program;
  let resolvedUniversity = undefined as Awaited<ReturnType<NonNullable<ResearchTargetResolver["resolveUniversity"]>>>;
  let resolvedProgram = undefined as Awaited<ReturnType<NonNullable<ResearchTargetResolver["resolveProgram"]>>>;

  if (suppliedUniversity?.id !== undefined) {
    if (resolver.resolveUniversity === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["university ID cannot be resolved without an application identity store"],
      };
    }
    resolvedUniversity = await resolver.resolveUniversity(suppliedUniversity.id);
    if (resolvedUniversity === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["university ID was not found in the application identity store"],
      };
    }
    if (!sameResearchIdentity(suppliedUniversity.name, resolvedUniversity.name)) {
      return {
        resolved: false,
        reason: "identity-conflict",
        warnings: ["supplied university name conflicts with the resolved university ID"],
      };
    }
    target.universityId = resolvedUniversity.id;
    target.universityName = resolvedUniversity.name;
    target.countryCode = resolvedUniversity.countryCode?.toUpperCase();
    target.officialUrl = resolvedUniversity.websiteUrl;
    target.officialHost = safeHost(resolvedUniversity.websiteUrl);
    target.rorId = resolvedUniversity.rorId;
  } else if (suppliedUniversity?.name !== undefined) {
    target.universityName = suppliedUniversity.name;
  }

  if (suppliedProgram?.id !== undefined) {
    if (resolver.resolveProgram === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["program ID cannot be resolved without an application identity store"],
      };
    }
    resolvedProgram = await resolver.resolveProgram(suppliedProgram.id);
    if (resolvedProgram === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["program ID was not found in the application identity store"],
      };
    }
    if (!sameResearchIdentity(suppliedProgram.name, resolvedProgram.name)) {
      return {
        resolved: false,
        reason: "identity-conflict",
        warnings: ["supplied program name conflicts with the resolved program ID"],
      };
    }
    if (suppliedProgram.universityId !== undefined && suppliedProgram.universityId !== resolvedProgram.universityId) {
      return {
        resolved: false,
        reason: "identity-conflict",
        warnings: ["supplied program university ID conflicts with the resolved program"],
      };
    }
    if (target.universityId !== undefined && target.universityId !== resolvedProgram.universityId) {
      return {
        resolved: false,
        reason: "identity-conflict",
        warnings: ["program university ID conflicts with the target university"],
      };
    }
    if (target.universityId === undefined) {
      if (resolver.resolveUniversity !== undefined) {
        resolvedUniversity = await resolver.resolveUniversity(resolvedProgram.universityId);
        if (resolvedUniversity === undefined) {
          return {
            resolved: false,
            reason: "unresolved-id",
            warnings: ["program resolved but its university ID was not found"],
          };
        }
        if (!sameResearchIdentity(target.universityName, resolvedUniversity.name)) {
          return {
            resolved: false,
            reason: "identity-conflict",
            warnings: ["supplied university name conflicts with the program's resolved university"],
          };
        }
        target.universityId = resolvedUniversity.id;
        target.universityName = resolvedUniversity.name;
        target.countryCode = resolvedUniversity.countryCode?.toUpperCase();
        target.officialUrl = resolvedUniversity.websiteUrl;
        target.officialHost = safeHost(resolvedUniversity.websiteUrl);
        target.rorId = resolvedUniversity.rorId;
      } else if (target.universityName !== undefined) {
        return {
          resolved: false,
          reason: "unresolved-id",
          warnings: ["program parent university cannot be verified without a university identity resolver"],
        };
      } else {
        target.universityId = resolvedProgram.universityId;
      }
    }
    target.programId = resolvedProgram.id;
    target.programName = resolvedProgram.name;
    target.degreeLevel = resolvedProgram.degreeLevel;
    target.subjectArea ??= resolvedProgram.subjectArea;
    if (target.officialUrl === undefined) target.officialUrl = resolvedProgram.officialUrl;
    target.officialHost ??= safeHost(resolvedProgram.officialUrl);
  } else if (suppliedProgram?.name !== undefined) {
    target.programName = suppliedProgram.name;
  }

  if (target.universityId === undefined && suppliedProgram?.universityId !== undefined) {
    if (resolver.resolveUniversity === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["program university ID cannot be resolved without an application identity store"],
      };
    }
    resolvedUniversity = await resolver.resolveUniversity(suppliedProgram.universityId);
    if (resolvedUniversity === undefined) {
      return {
        resolved: false,
        reason: "unresolved-id",
        warnings: ["program university ID was not found in the application identity store"],
      };
    }
    if (!sameResearchIdentity(target.universityName, resolvedUniversity.name)) {
      return {
        resolved: false,
        reason: "identity-conflict",
        warnings: ["supplied university name conflicts with the program university ID"],
      };
    }
    target.universityId = resolvedUniversity.id;
    target.universityName = resolvedUniversity.name;
    target.countryCode = resolvedUniversity.countryCode?.toUpperCase();
    target.officialUrl = resolvedUniversity.websiteUrl;
    target.officialHost = safeHost(resolvedUniversity.websiteUrl);
    target.rorId = resolvedUniversity.rorId;
  }

  if (target.universityName === undefined && target.programName === undefined && target.subjectArea === undefined) {
    return {
      resolved: false,
      reason: "insufficient-institutional-identity",
      warnings: ["resolved target did not contain a usable name, program, or subject area"],
    };
  }

  if (target.programName !== undefined && target.universityName === undefined) {
    warnings.push("program-name-only request has no institutional direct/ROR fallback");
  }
  if (target.subjectArea !== undefined && target.universityName === undefined) {
    warnings.push("subject-area-only request has no institutional direct/ROR fallback");
  }

  return { resolved: true, target, warnings };
}

export function targetHasInstitutionalIdentity(target: ResolvedResearchTarget): boolean {
  return target.universityId !== undefined || target.universityName !== undefined || target.officialUrl !== undefined;
}

export function targetHostMatches(hostname: string, target: ResolvedResearchTarget): boolean {
  return target.officialHost !== undefined && hostMatchesOfficialRoot(hostname, target.officialHost);
}
