export class HttpError extends Error {
  status: number;
  upstreamStatus?: number;
  upstreamBodyPreview?: string;

  constructor(message: string, status: number, upstreamStatus?: number, upstreamBodyPreview?: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
    this.upstreamBodyPreview = upstreamBodyPreview;
  }
}

export function getBodyPreview(body: string) {
  return body.slice(0, 500);
}

export async function readResponseBody(response: Response) {
  return response.text().catch(() => "");
}

export function shouldExposeUpstreamBodyPreview() {
  return process.env.VERCEL_ENV !== "production";
}
