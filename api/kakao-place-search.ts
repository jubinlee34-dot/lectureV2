import type { VercelRequest, VercelResponse } from "@vercel/node";

interface KakaoPlaceDocument {
  id?: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
  phone?: string;
  place_url?: string;
}

interface KakaoPlaceSearchItem {
  id: string;
  place_name: string;
  road_address_name: string;
  address_name: string;
  address: string;
  x: string;
  y: string;
  phone: string;
  place_url: string;
}

class HttpError extends Error {
  status: number;
  upstreamStatus?: number;
  upstreamBodyPreview?: string;

  constructor(message: string, status: number, upstreamStatus?: number, upstreamBodyPreview?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
    this.upstreamBodyPreview = upstreamBodyPreview;
  }
}

function getKakaoRestApiKey() {
  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();
  if (!apiKey) {
    throw new HttpError("KAKAO_REST_API_KEY is not configured", 500);
  }
  const normalizedKey = apiKey.replace(/^KakaoAK\s+/i, "").trim();
  if (!normalizedKey) {
    throw new HttpError("KAKAO_REST_API_KEY is not configured", 500);
  }
  return normalizedKey;
}

function getBodyPreview(body: string) {
  return body.slice(0, 500);
}

function mapPlace(document: KakaoPlaceDocument): KakaoPlaceSearchItem {
  const roadAddress = document.road_address_name || "";
  const jibunAddress = document.address_name || "";

  return {
    id: document.id || "",
    place_name: document.place_name || "",
    road_address_name: roadAddress,
    address_name: jibunAddress,
    address: roadAddress || jibunAddress,
    x: document.x || "",
    y: document.y || "",
    phone: document.phone || "",
    place_url: document.place_url || "",
  };
}

async function searchKakaoPlaces(query: string, apiKey: string): Promise<KakaoPlaceSearchItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new HttpError("query is required", 400);
  }

  const params = new URLSearchParams({ query: cleanQuery });
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
  });
  const body = await response.text().catch(() => "");
  const bodyPreview = getBodyPreview(body);

  if (!response.ok) {
    console.error("Kakao place search failed", {
      status: response.status,
      query: cleanQuery,
      bodyPreview,
    });
    throw new HttpError("Kakao place search failed", 502, response.status, bodyPreview);
  }

  try {
    const data = JSON.parse(body) as { documents?: KakaoPlaceDocument[] };
    return (data.documents || []).map(mapPlace);
  } catch {
    console.error("Kakao place search returned invalid JSON", {
      status: response.status,
      query: cleanQuery,
      bodyPreview,
    });
    throw new HttpError("Kakao place search returned invalid JSON", 502, response.status, bodyPreview);
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
      responseBody.upstreamBodyPreview = error.upstreamBodyPreview;
    }

    res.status(status).json(responseBody);
  }
}
