import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getNormalizedKakaoRestApiKey } from "./_lib/env";
import { HttpError, shouldExposeUpstreamBodyPreview } from "./_lib/http";
import {
  fetchKakaoKeywordSearch,
  mapKakaoPlaceSearchItem,
  type KakaoPlaceDocument,
  type KakaoPlaceSearchItem,
} from "./_lib/kakao";

const KAKAO_REST_API_KEY_ERROR = "KAKAO_REST_API_KEY is not configured";

function getKakaoRestApiKey() {
  return getNormalizedKakaoRestApiKey(KAKAO_REST_API_KEY_ERROR);
}

async function searchKakaoPlaces(query: string, apiKey: string): Promise<KakaoPlaceSearchItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new HttpError("query is required", 400);
  }

  const { response, body, bodyPreview } = await fetchKakaoKeywordSearch(cleanQuery, apiKey);

  if (!response.ok) {
    console.error("Kakao place search failed", {
      status: response.status,
      query: cleanQuery,
      upstreamBodyPreview: bodyPreview,
    });
    throw new HttpError("Kakao place search failed", 502, response.status, bodyPreview);
  }

  try {
    const data = JSON.parse(body) as { documents?: KakaoPlaceDocument[] };
    return (data.documents || []).map(mapKakaoPlaceSearchItem);
  } catch {
    console.error("Kakao place search returned invalid JSON", {
      status: response.status,
      query: cleanQuery,
      upstreamBodyPreview: bodyPreview,
    });
    throw new HttpError("Kakao place search failed", 502, response.status, bodyPreview);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "";
    if (!query.trim()) {
      res.status(400).json({ ok: false, error: "query is required" });
      return;
    }

    const items = await searchKakaoPlaces(query, getKakaoRestApiKey());
    res.status(200).json({ ok: true, query, items });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const responseBody: Record<string, unknown> = { ok: false, error: message };

    if (error instanceof HttpError && error.upstreamStatus) {
      responseBody.upstreamStatus = error.upstreamStatus;
      if (shouldExposeUpstreamBodyPreview()) {
        responseBody.upstreamBodyPreview = error.upstreamBodyPreview;
      }
    }

    res.status(status).json(responseBody);
  }
}
