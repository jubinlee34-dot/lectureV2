import type { VercelRequest, VercelResponse } from "@vercel/node";

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const NAVER_AUTH_ERROR_MESSAGE =
  "네이버 인증 실패: API 키, 헤더 방식, 서비스 활성화 상태를 확인하세요";
const NAVER_MAPS_BASE_URL = "https://maps.apigw.ntruss.com";

function hasNaverApiKeyId() {
  return Boolean(process.env.NAVER_MAPS_API_KEY_ID);
}

function hasNaverApiKey() {
  return Boolean(process.env.NAVER_MAPS_API_KEY);
}

function getNaverKeys() {
  const apiKeyId = process.env.NAVER_MAPS_API_KEY_ID;
  const apiKey = process.env.NAVER_MAPS_API_KEY;

  if (!apiKeyId || !apiKey) {
    throw new HttpError("네이버 Maps API 환경변수가 설정되지 않았습니다", 500);
  }

  return { apiKeyId, apiKey };
}

function logNaverResponse(url: string, status: number, body: string) {
  console.error("Naver Maps API response", {
    naverApiKeyIdExists: hasNaverApiKeyId(),
    naverApiKeyExists: hasNaverApiKey(),
    naverApiUrl: url,
    naverResponseStatus: status,
    naverResponseBody: body,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "서울역";
    const { apiKeyId, apiKey } = getNaverKeys();
    const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const url = `${NAVER_MAPS_BASE_URL}/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": apiKeyId,
        "x-ncp-apigw-api-key": apiKey,
        Accept: "application/json",
      },
    });
    const body = await response.text().catch(() => "");

    if (!response.ok) {
      logNaverResponse(url, response.status, body);
      if (response.status === 401 || response.status === 403) {
        throw new HttpError(NAVER_AUTH_ERROR_MESSAGE, response.status);
      }
      throw new HttpError(`Naver Maps API failed with status ${response.status}`, response.status);
    }

    res.status(200).json(JSON.parse(body));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(status).json({ error: message });
  }
}
