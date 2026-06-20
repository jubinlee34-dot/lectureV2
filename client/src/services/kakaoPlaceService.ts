export interface KakaoPlaceCandidate {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  x: string;
  y: string;
}

export class KakaoPlaceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "KakaoPlaceRequestError";
    this.status = status;
  }
}

export async function searchKakaoPlaces(query: string): Promise<KakaoPlaceCandidate[]> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`/api/kakao-places?${params.toString()}`);
  const body = (await response.json().catch(() => ({}))) as {
    places?: KakaoPlaceCandidate[];
    error?: string;
  };

  if (!response.ok) {
    throw new KakaoPlaceRequestError(body.error || "카카오 장소 검색에 실패했습니다.", response.status);
  }

  return body.places || [];
}
