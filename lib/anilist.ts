import db from "./db";

const ANILIST_API = "https://graphql.anilist.co";

async function anilistRequest(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json = await res.json() as { data?: unknown; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function findAnilistId(token: string, title: string): Promise<number | null> {
  const data = await anilistRequest(token, `
    query ($search: String) {
      Media(search: $search, type: MANGA) { id title { romaji english } }
    }
  `, { search: title }) as { Media?: { id: number } } | null;
  return data?.Media?.id ?? null;
}

export async function syncAnilistProgress(userId: number, seriesId: number, chaptersRead: number): Promise<void> {
  const user = db.prepare("SELECT anilist_token FROM users WHERE id = ?").get(userId) as { anilist_token: string } | undefined;
  if (!user?.anilist_token) return;

  let { anilist_id } = db.prepare("SELECT anilist_id FROM series WHERE id = ?").get(seriesId) as { anilist_id: number | null };
  const { title } = db.prepare("SELECT title FROM series WHERE id = ?").get(seriesId) as { title: string };

  if (!anilist_id) {
    try {
      const found = await findAnilistId(user.anilist_token, title);
      if (!found) return;
      anilist_id = found;
      db.prepare("UPDATE series SET anilist_id = ? WHERE id = ?").run(anilist_id, seriesId);
    } catch {
      return;
    }
  }

  try {
    await anilistRequest(user.anilist_token, `
      mutation ($mediaId: Int, $progress: Int, $status: MediaListStatus) {
        SaveMediaListEntry(mediaId: $mediaId, progress: $progress, status: $status) { id }
      }
    `, {
      mediaId: anilist_id,
      progress: chaptersRead,
      status: "CURRENT",
    });
  } catch (e) {
    console.warn("[anilist] sync failed for series", seriesId, (e as Error).message);
  }
}
