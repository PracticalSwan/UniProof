"use client";

import {
  persistenceErrorSchema,
  savedArtifactListResponseSchema,
  savedArtifactMetadataSchema,
  savedArtifactRowSchema,
  savedArtifactSchema,
  type PersistenceError,
  type SavedArtifactKind,
  type SavedArtifactMetadata,
  type SavedArtifactRow,
} from "./contracts";

type ClientFailure = Readonly<{
  ok: false;
  error: PersistenceError;
  ambiguousMutation?: boolean;
}>;

type ClientSuccess<T> = Readonly<{ ok: true; value: T }>;
export type PersistenceClientResult<T> = ClientSuccess<T> | ClientFailure;

const unavailable: PersistenceError = {
  error: "persistence-unavailable",
  message: "Private saved snapshots are temporarily unavailable.",
};

async function parseFailure(response: Response): Promise<PersistenceError> {
  try {
    const parsed = persistenceErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : unavailable;
  } catch {
    return unavailable;
  }
}

export async function listSavedArtifacts(kind?: SavedArtifactKind): Promise<PersistenceClientResult<readonly SavedArtifactMetadata[]>> {
  try {
    const query = kind === undefined ? "" : `?kind=${encodeURIComponent(kind)}`;
    const response = await fetch(`/api/saved-artifacts${query}`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return { ok: false, error: await parseFailure(response) };
    const parsed = savedArtifactListResponseSchema.safeParse(await response.json());
    return parsed.success ? { ok: true, value: parsed.data.artifacts } : { ok: false, error: unavailable };
  } catch {
    return { ok: false, error: unavailable };
  }
}

export async function getSavedArtifact(id: string): Promise<PersistenceClientResult<SavedArtifactRow>> {
  try {
    const response = await fetch(`/api/saved-artifacts/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) return { ok: false, error: await parseFailure(response) };
    const parsed = savedArtifactRowSchema.safeParse(await response.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: unavailable };
  } catch {
    return { ok: false, error: unavailable };
  }
}

export async function saveSavedArtifact(input: unknown): Promise<PersistenceClientResult<SavedArtifactMetadata>> {
  const parsedArtifact = savedArtifactSchema.safeParse(input);
  if (!parsedArtifact.success) {
    return {
      ok: false,
      error: { error: "invalid-request", message: "The saved-snapshot request is invalid." },
    };
  }
  try {
    const response = await fetch("/api/saved-artifacts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(parsedArtifact.data),
    });
    if (!response.ok) {
      const error = await parseFailure(response);
      return response.status >= 500
        ? { ok: false, error, ambiguousMutation: true }
        : { ok: false, error };
    }
    const parsed = savedArtifactMetadataSchema.safeParse(await response.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: unavailable, ambiguousMutation: true };
  } catch {
    return { ok: false, error: unavailable, ambiguousMutation: true };
  }
}

export async function deleteSavedArtifact(id: string): Promise<PersistenceClientResult<true>> {
  try {
    const response = await fetch(`/api/saved-artifacts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!response.ok) {
      const error = await parseFailure(response);
      return response.status >= 500
        ? { ok: false, error, ambiguousMutation: true }
        : { ok: false, error };
    }
    const body = await response.json() as unknown;
    if (typeof body !== "object" || body === null || (body as { deleted?: unknown }).deleted !== true) {
      return { ok: false, error: unavailable, ambiguousMutation: true };
    }
    return { ok: true, value: true };
  } catch {
    return { ok: false, error: unavailable, ambiguousMutation: true };
  }
}
