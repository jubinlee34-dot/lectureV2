import { HttpError } from "./http";

export function hasKakaoRestApiKey() {
  return Boolean(process.env.KAKAO_REST_API_KEY);
}

export function getRequiredKakaoRestApiKey(message: string) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new HttpError(message, 500);
  }
  return apiKey;
}

export function getNormalizedKakaoRestApiKey(message: string) {
  const apiKey = getRequiredKakaoRestApiKey(message).trim();
  const normalizedKey = apiKey.replace(/^KakaoAK\s+/i, "").trim();
  if (!normalizedKey) {
    throw new HttpError(message, 500);
  }
  return normalizedKey;
}
