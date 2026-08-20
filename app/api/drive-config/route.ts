export const runtime = "edge";

export async function GET() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim() ?? "";
  return Response.json({ configured: Boolean(clientId), clientId: clientId || null });
}
