import { headers } from "next/headers";

export async function getRequestMeta(): Promise<{ ip: string | undefined; userAgent: string | undefined }> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  const userAgent = h.get("user-agent") ?? undefined;
  return { ip, userAgent };
}
