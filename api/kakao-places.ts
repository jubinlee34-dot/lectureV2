import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequiredKakaoRestApiKey, hasKakaoRestApiKey } from "./_lib/env";
import { HttpError } from "./_lib/http";
import {
  fetchKakaoKeywordSearch,
  mapKakaoPlaceCandidate,
  type KakaoPlaceCandidate,
  type KakaoPlaceDocument,
} from "./_lib/kakao";

const KAKAO_REST_API_KEY_ERROR = "카카오 REST API 키가 설정되지 않았습니다.";
const KAKAO_QUERY_REQUIRED_ERROR = "검색어를 입력하세요.";
const KAKAO_AUTH_ERROR = "카카오 인증 실패: REST API 키 설정을 확인하세요.";

function getKakaoRestApiKey() {
  return getRequiredKakaoRestApiKey(KAKAO_REST_API_KEY_ERROR);
}

async function searchKakaoPlaces(query: string, apiKey: string): Promise<KakaoPlaceCandidate[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new HttpError(KAKAO_QUERY_REQUIRED_ERROR, 400);
  }

  const { url, response, body } = await fetchKakaoKeywordSearch(cleanQuery, apiKey, {
    size: "10",
    acceptJson: true,
  });

  if (!response.ok) {
    console.error("Kakao Local API request failed", {
      kakaoRestApiKeyExists: hasKakaoRestApiKey(),
      kakaoApiUrl: url,
      kakaoResponseStatus: response.status,
      kakaoResponseBody: body,
    });

    if (response.status === 401 || response.status === 403) {
      throw new HttpError(KAKAO_AUTH_ERROR, response.status);
    }

    throw new HttpError(`Kakao Local API failed with status ${response.status}`, response.status);
  }

  const data = JSON.parse(body) as { documents?: KakaoPlaceDocument[] };
  return (data.documents || []).map(mapKakaoPlaceCandidate);
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
