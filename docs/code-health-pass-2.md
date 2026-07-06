# Code Health Pass 2

Date: 2026-07-07
Branch: refactor/api-shared-helpers-pass-2

## Scope

This pass focused on API helper deduplication with no intended behavior changes.

Guardrails followed:
- UI, layout, CSS, and visible copy were not changed.
- API response structures were not changed.
- Supabase schema and migrations were not changed.
- Dependencies were not added or removed.
- Environment variable names were not changed: `NAVER_MAPS_API_KEY_ID`, `NAVER_MAPS_API_KEY`, `KAKAO_REST_API_KEY`.
- Naver base URL, endpoints, and header names were not changed.
- Kakao production error response policy for `/api/kakao-place-search` was preserved.
- Vercel serverless default export handlers were preserved.

## Cleanup Applied

- Added small API helper modules under `api/_lib`:
  - `http.ts`: shared `HttpError`, response body reading, body preview, and production preview exposure guard.
  - `env.ts`: shared Kakao REST API key presence and retrieval helpers.
  - `kakao.ts`: shared Kakao keyword-search fetch helper and response mappers.
- Refactored `api/kakao-place-search.ts` to reuse the shared helpers while keeping the success response `{ ok, query, items }` and production error response policy unchanged.
- Refactored `api/kakao-places.ts` to reuse the shared helpers while keeping the existing `{ places }`, health, and `{ error }` response shapes unchanged.

## Deferred Candidates

- `api/naver-directions.ts` and `api/test-geocode.ts` still duplicate Naver key, fetch, and error handling logic. They were left unchanged in this pass to avoid touching stable Naver behavior.
- `vite.config.ts` duplicates local dev proxy helpers for Naver and Kakao. It was left unchanged because sharing Vercel serverless helpers with the Vite dev proxy could increase local build and proxy risk.
- `client/src/services/kakaoPlaceService.ts` has client-side mapping that mirrors the server response shape. It was left unchanged because it is part of the browser-facing contract normalization.

## Manual Confirmation To Run After Deployment

- `/api/naver-directions?health=1`
- `/api/kakao-places?health=1`
- `/api/kakao-place-search?query=%EA%B4%91%EC%96%91%EB%A7%A4%ED%99%94%ED%9A%8C%EA%B4%80`
- Vercel Preview: /api/kakao-place-search?query=%EB%8C%80%EC%A0%84%EA%B4%B4%EC%A0%95%EC%A4%91%ED%95%99%EA%B5%90 should return JSON, not FUNCTION_INVOCATION_FAILED.
- Confirm Kakao place-search success items still include `id`, `place_name`, `road_address_name`, `address_name`, `address`, `x`, `y`, `phone`, and `place_url`.
- Confirm production Kakao upstream failures do not include `upstreamBodyPreview` in client responses.

## Verification

- API-only TypeScript check: passed
- `pnpm run check`: passed
- `pnpm run build`: passed
- `git diff --stat`: reviewed
- `git diff --name-only`: reviewed
- `git status`: reviewed