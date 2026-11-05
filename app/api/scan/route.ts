import { NextResponse } from "next/server";


/**
 * Kartvizit servisine proxy.
 * x-api-key sadece sunucuda tutulur, tarayıcıya hiç gitmez.
 *
 * .env.local:
 *   CARD_SCAN_URL=http://localhost:8000/scan/
 *   CARD_SCAN_API_KEY=...
 */
export async function POST(request: Request) {
  const url = process.env.CARD_SCAN_URL;
  const apiKey = process.env.CARD_SCAN_API_KEY;

  if (!url || !apiKey) {
    return NextResponse.json(
      { detail: "Kartvizit servisi ayarları eksik (CARD_SCAN_URL / CARD_SCAN_API_KEY)." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
      cache: "no-store",
    });

    return new NextResponse(await upstream.text(), {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Kartvizit servisine ulaşılamadı." },
      { status: 502 }
    );
  }
}