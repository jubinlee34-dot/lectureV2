export interface KakaoPlaceCandidate {
  id: string;
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  address: string;
  x: string;
  y: string;
  phone: string;
  placeUrl: string;
}

interface KakaoPlaceSearchItem {
  id?: string;
  place_name?: string;
  road_address_name?: string;
  address_name?: string;
  address?: string;
  x?: string;
  y?: string;
  phone?: string;
  place_url?: string;
}

export class KakaoPlaceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KakaoPlaceRequestError";
    this.status = status;
  }
}

function mapPlace(item: KakaoPlaceSearchItem): KakaoPlaceCandidate {
  return {
    id: item.id || "",
    placeName: item.place_name || "",
    roadAddress: item.road_address_name || "",
    jibunAddress: item.address_name || "",
    address: item.address || item.road_address_name || item.address_name || "",
    x: item.x || "",
    y: item.y || "",
    phone: item.phone || "",
    placeUrl: item.place_url || "",
  };
}

export async function searchKakaoPlaces(query: string): Promise<KakaoPlaceCandidate[]> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`/api/kakao-place-search?${params.toString()}`);
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    items?: KakaoPlaceSearchItem[];
    error?: string;
  };

  if (!response.ok || body.ok === false) {
    throw new KakaoPlaceRequestError(body.error || "카카오 장소 검색에 실패했습니다.", response.status);
  }

  return (body.items || []).map(mapPlace);
}