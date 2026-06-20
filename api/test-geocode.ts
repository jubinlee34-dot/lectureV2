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

function hasNaverClientId() {
  return Boolean(process.env.NAVER_CLIENT_ID);
}

function hasNaverClientSecret() {
  return Boolean(process.env.NAVER_CLIENT_SECRET);
}

function getNaverKeys() {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new HttpError("네이버 API 환경변수가 설정되지 않았습니다", 500);
  }

  return { clientId, clientSecret };
}

function logNaverResponse(url: string, status: number, body: string) {
  console.error("Naver API response", {
    naverClientIdExists: hasNaverClientId(),
    naverClientSecretExists: hasNaverClientSecret(),
    naverApiUrl: url,
    naverResponseStatus: status,
    naverResponseBody: body,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const query = typeof req.query.query === "string" ? req.query.query : "서울역";
    const { clientId, clientSecret } = getNaverKeys();
    const cleanQuery = query.replace(/\s*\(.*?\)\s*/g, " ").trim();
    const url = `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(url, {
      headers: {
        "x-ncp-apigw-api-key-id": clientId,
        "x-ncp-apigw-api-key": clientSecret,
      },
    });
    const body = await response.text();

    if (!response.ok) {
      logNaverResponse(url, response.status, body);
      if (response.status === 401) {
        throw new HttpError(NAVER_AUTH_ERROR_MESSAGE, 401);
      }
      throw new HttpError(`Naver API failed with status ${response.status}`, response.status);
    }

    res.status(200).json(JSON.parse(body));
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal Server Error";
    res.status(status).json({ error: message });
  }
}
