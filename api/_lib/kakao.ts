import { getBodyPreview, readResponseBody } from "./http";

export interface KakaoPlaceDocument {
  id?: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
  phone?: string;
  place_url?: string;
}

export interface KakaoPlaceSearchItem {
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

export interface KakaoPlaceCandidate {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  x: string;
  y: string;
}

const KAKAO_LOCAL_KEYWORD_SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

interface KakaoKeywordSearchOptions {
  size?: string;
  acceptJson?: boolean;
}

export function mapKakaoPlaceSearchItem(document: KakaoPlaceDocument): KakaoPlaceSearchItem {
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

export function mapKakaoPlaceCandidate(document: KakaoPlaceDocument): KakaoPlaceCandidate {
  return {
    placeName: document.place_name || "",
    roadAddress: document.road_address_name || "",
    jibunAddress: document.address_name || "",
    x: document.x || "",
    y: document.y || "",
  };
}

export async function fetchKakaoKeywordSearch(query: string, apiKey: string, options: KakaoKeywordSearchOptions = {}) {
  const params = new URLSearchParams({ query });
  if (options.size) {
    params.set("size", options.size);
  }

  const headers: Record<string, string> = {
    Authorization: `KakaoAK ${apiKey}`,
  };
  if (options.acceptJson) {
    headers.Accept = "application/json";
  }

  const url = `${KAKAO_LOCAL_KEYWORD_SEARCH_URL}?${params.toString()}`;
  const response = await fetch(url, { headers });
  const body = await readResponseBody(response);

  return {
    url,
    response,
    body,
    bodyPreview: getBodyPreview(body),
  };
}
