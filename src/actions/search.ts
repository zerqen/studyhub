"use server";

import { withUser, type ActionResult } from "@/lib/action";
import { searchMaterials, type SearchHit } from "@/lib/search-materials";

export type { SearchHit } from "@/lib/search-materials";

export async function globalSearch(query: string): Promise<ActionResult<SearchHit[]>> {
  return withUser((userId) => searchMaterials(userId, query));
}
