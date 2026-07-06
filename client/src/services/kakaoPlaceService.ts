export interface KakaoPlaceCandidate {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  x: string;
  y: string;
}

interface KakaoPlaceDocument {
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  x?: string;
  y?: string;
}

type KakaoPlacesStatus = "OK" | "ZERO_RESULT" | "ERROR";

type KakaoKeywordSearchCallback = (data: KakaoPlaceDocument[], status: KakaoPlacesStatus) => void;

interface KakaoPlacesSearch {
  keywordSearch: (query: string, callback: KakaoKeywordSearchCallback) => void;
}

interface KakaoMapsSdk {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Places: new () => KakaoPlacesSearch;
      Status: Record<KakaoPlacesStatus, KakaoPlacesStatus>;
    };
  };
}

declare global {
  interface Window {
    kakao?: KakaoMapsSdk;
  }
}

let kakaoSdkPromise: Promise<KakaoMapsSdk> | null = null;

export class KakaoPlaceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KakaoPlaceRequestError";
    this.status = status;
  }
}

function getKakaoJavascriptKey() {
  const key = import.meta.env.VITE_KAKAO_MAPS_JAVASCRIPT_KEY as string | undefined;
  if (!key?.trim()) {
    throw new KakaoPlaceRequestError("VITE_KAKAO_MAPS_JAVASCRIPT_KEY가 설정되지 않았습니다.", 500);
  }
  return key.trim();
}

function loadKakaoSdk(): Promise<KakaoMapsSdk> {
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;

  kakaoSdkPromise = new Promise((resolve, reject) => {
    const appkey = getKakaoJavascriptKey();
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-kakao-maps-sdk='true']");

    const load = () => {
      if (!window.kakao?.maps?.load) {
        reject(new KakaoPlaceRequestError("카카오 Maps JavaScript SDK를 불러오지 못했습니다.", 500));
        return;
      }

      window.kakao.maps.load(() => {
        if (window.kakao?.maps?.services) {
          resolve(window.kakao);
          return;
        }
        reject(new KakaoPlaceRequestError("카카오 Places services 라이브러리를 사용할 수 없습니다.", 500));
      });
    };

    if (existingScript) {
      existingScript.addEventListener("load", load, { once: true });
      existingScript.addEventListener("error", () => reject(new KakaoPlaceRequestError("카카오 Maps JavaScript SDK 로드에 실패했습니다.", 500)), { once: true });
      if (window.kakao?.maps?.load) load();
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMapsSdk = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}&libraries=services&autoload=false`;
    script.onload = load;
    script.onerror = () => reject(new KakaoPlaceRequestError("카카오 Maps JavaScript SDK 로드에 실패했습니다.", 500));
    document.head.appendChild(script);
  });

  kakaoSdkPromise.catch(() => {
    kakaoSdkPromise = null;
  });

  return kakaoSdkPromise;
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

export async function searchKakaoPlaces(query: string): Promise<KakaoPlaceCandidate[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new KakaoPlaceRequestError("검색어를 입력하세요.", 400);
  }

  const kakao = await loadKakaoSdk();
  const places = new kakao.maps.services.Places();

  return new Promise((resolve, reject) => {
    places.keywordSearch(cleanQuery, (data, status) => {
      if (status === kakao.maps.services.Status.OK) {
        resolve(data.map(mapPlace));
        return;
      }

      if (status === kakao.maps.services.Status.ZERO_RESULT) {
        resolve([]);
        return;
      }

      reject(new KakaoPlaceRequestError("카카오 장소 검색에 실패했습니다.", 500));
    });
  });
}