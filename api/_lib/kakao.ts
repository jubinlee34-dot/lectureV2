import { getBodyPreview, readResponseBody } from "./http.js";

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
const KAKAO_MEMO_WORDS = ["지역아동센터", "지역아동", "강의", "교육", "수업"];
const MAX_KAKAO_FALLBACK_QUERIES = 3;

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

function normalizeKakaoSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function removeParentheticalText(query: string) {
  return normalizeKakaoSearchQuery(query.replace(/\s*[([{（［【].*?[)\]}）］】]\s*/g, " "));
}

function removeMemoWords(query: string) {
  return normalizeKakaoSearchQuery(
    KAKAO_MEMO_WORDS.reduce((nextQuery, word) => nextQuery.replace(new RegExp(`\\s*${word}\\s*`, "g"), " "), query)
  );
}

function removeLastToken(query: string) {
  const tokens = normalizeKakaoSearchQuery(query).split(" ").filter(Boolean);
  if (tokens.length < 2) {
    return "";
  }
  return tokens.slice(0, -1).join(" ");
}

export function buildKakaoKeywordSearchQueries(query: string) {
  const cleanQuery = normalizeKakaoSearchQuery(query);
  const candidates = [
    cleanQuery,
    removeParentheticalText(cleanQuery),
    removeMemoWords(removeParentheticalText(cleanQuery)),
    removeLastToken(removeMemoWords(removeParentheticalText(cleanQuery))),
    removeLastToken(removeParentheticalText(cleanQuery)),
  ];
  const uniqueCandidates: string[] = [];

  for (const candidate of candidates) {
    if (candidate && !uniqueCandidates.includes(candidate)) {
      uniqueCandidates.push(candidate);
    }
  }

  return [uniqueCandidates[0], ...uniqueCandidates.slice(1, MAX_KAKAO_FALLBACK_QUERIES + 1)].filter(Boolean);
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
