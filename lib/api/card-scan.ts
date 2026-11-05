import {
  ocrJsonSchemas,
  type CustomerFieldName,
  type CustomerType,
} from "@/lib/schemas/customer";

/**
 * Tarayıcı doğrudan servise gitmez; Next.js route'una (src/app/api/scan/route.ts) gider,
 * o da x-api-key ekleyip FastAPI'ye iletir.
 */
const CARD_SCAN_URL = "/api/scan";

/** Servis response'u: { result: { mode, raw_text, data, missing_fields } } */
type ScanApiResponse = {
  result: {
    mode?: "raw_text" | "structured" | null;
    raw_text: string;
    data?: Record<string, unknown> | null;
    missing_fields?: string[] | null;
  };
};

export type CardScanResult = Partial<Record<CustomerFieldName, string>>;

const FIELD_NAMES: CustomerFieldName[] = [
  "ad",
  "soyad",
  "alias",
  "vkn",
  "ticariUnvan",
  "email",
];

/**
 * Kartvizit görselini servise gönderir.
 * Müşteri türüne göre farklı JSON Schema gider (ocrJsonSchemas),
 * servis bu schema ile çıkarım yapıp result.data içinde döner.
 */
export async function scanBusinessCard(
  file: File,
  customerType: CustomerType
): Promise<CardScanResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("schema", JSON.stringify(ocrJsonSchemas[customerType]));

  const res = await fetch(CARD_SCAN_URL, { method: "POST", body });

  if (!res.ok) {
    const detail = await res
      .json()
      .then((j) => j?.detail)
      .catch(() => null);
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Kartvizit servisi hata döndü: ${res.status}`
    );
  }

  const json = (await res.json()) as ScanApiResponse;
  const fields = mapScanResponse(json);

  // Hiçbir alan çıkarılamadıysa (örn. sadece raw_text döndüyse) hata say
  if (Object.keys(fields).length === 0) {
    throw new Error("Kartvizitten alan çıkarılamadı");
  }

  return fields;
}

/** result.data içindeki değerleri form alanlarına çevirir (null/boş olanlar atlanır). */
function mapScanResponse(json: ScanApiResponse): CardScanResult {
  const data = json.result?.data ?? {};
  const result: CardScanResult = {};

  for (const name of FIELD_NAMES) {
    const value = data[name];
    if (typeof value === "string" && value.trim()) {
      result[name] = value.trim();
    }
  }

  return result;
}