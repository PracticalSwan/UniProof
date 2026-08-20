import { researchCatalog } from "@/lib/research/catalog/data";
import { createCatalogTargetResolver } from "@/lib/research/catalog/resolver";
import { createResearchPostHandler } from "@/lib/research/mode/handler";
import { runPhase2Research } from "@/lib/research/orchestration";

export const runtime = "nodejs";
export const maxDuration = 300;

const postResearch = createResearchPostHandler({
  catalog: researchCatalog,
  targetResolver: createCatalogTargetResolver(researchCatalog),
  runResearch: runPhase2Research,
});

export async function POST(request: Request): Promise<Response> {
  return postResearch(request);
}
