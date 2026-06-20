import type { VercelRequest, VercelResponse } from "@vercel/node";

interface KakaoPlaceDocument {
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
}

interface KakaoPlaceCandidate {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  x: string;
  y: string;
}

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function hasKakaoRestApiKey() {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

function getKakaoRestApiKey() {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new HttpError("카카오 REST API 키가 설정되지 않았습니다.", 500);
  }
  return apiKey;
}

function mapPlace(document: KakaoPlaceDocument): KakaoPlaceCandidate {
  return {
    placeName: document.place_name || "",
    roadAddress: document.road_address_name || "",
    jibunAddress: document.address_name || "",
    x: document.x || "",
    y: document.y || "",
  };
}

async function searchKakaoPlaces(query: string, apiKey: string): Promise<KakaoPlaceCandidate[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new HttpError("검색어를 입력하세요.", 400);
  }

  const params = new URLSearchParams({
    query: cleanQuery,
    size: "10",
  });
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
      Accept: "application/json",
    },
  });
  const body = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("Kakao Local API request failed", {
      kakaoRestApiKeyExists: hasKakaoRestApiKey(),
      kakaoApiUrl: url,
      kakaoResponseStatus: response.status,
      kakaoResponseBody: body,
    });

    if (response.status === 401 || response.status === 403) {
      throw new HttpError("카카오 인증 실패: REST API 키 설정을 확인하세요.", response.status);
    }

    throw new HttpError(`Kakao Local API failed with status ${response.status}`, response.status);
  }

  const data = JSON.parse(body) as { documents?: KakaoPlaceDocument[] };
  return (data.documents || []).map(mapPlace);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const health = typeof req.query.health === "string" ? req.query.health : "";
    const query = typeof req.query.query === "string" ? req.query.query : "";

    if (health === "1") {
      res.status(200).json({
        configured: hasKakaoRestApiKey(),
        kakaoRestApiKeyExists: hasKakaoRestApiKey(),
      });
      return;
    }

    const apiKey = getKakaoRestApiKey();
    const places = await searchKakaoPlaces(query, apiKey);
    res.status(200).json({ places });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(status).json({ error: message });
  }
}
