import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Sabitler                                                            */
/* ------------------------------------------------------------------ */

export const CUSTOMER_TYPES = [
  { value: "bireysel", label: "Bireysel" },
  { value: "kurumsal", label: "Kurumsal" },
  { value: "bireysel-isletme", label: "Bireysel İşletme" },
] as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[number]["value"];

export const SOURCES = [
  "Referans",
  "Bayi",
  "Kampanya",
  "Tavsiye Üzerine",
  "Etkinlik",
  "Web Form",
  "Saha Ziyareti",
  "Soğuk Arama",
] as const;

export type Source = (typeof SOURCES)[number];

/* ------------------------------------------------------------------ */
/* Form değer tipi (tüm alanlar düz, türler arası geçişte veri korunur) */
/* ------------------------------------------------------------------ */

export type CustomerFormValues = {
  customerType: CustomerType;
  ad: string;
  soyad: string;
  alias: string;
  vkn: string;
  ticariUnvan: string;
  email: string;
  kaynak: Source;
};

export type CustomerFieldName = Exclude<
  keyof CustomerFormValues,
  "customerType" | "kaynak"
>;

export const defaultValues: CustomerFormValues = {
  customerType: "bireysel",
  ad: "",
  soyad: "",
  alias: "",
  vkn: "",
  ticariUnvan: "",
  email: "",
  kaynak: "Referans",
};

/* ------------------------------------------------------------------ */
/* Türe göre görünen / zorunlu alanlar (analiz dokümanı bölüm 3.1)     */
/* ------------------------------------------------------------------ */

export const VISIBLE_FIELDS: Record<CustomerType, CustomerFieldName[]> = {
  bireysel: ["ad", "soyad", "ticariUnvan", "email"],
  kurumsal: ["vkn", "alias", "ticariUnvan", "email"],
  "bireysel-isletme": ["ad", "soyad", "vkn", "ticariUnvan", "email"],
};

export const REQUIRED_FIELDS: Record<CustomerType, CustomerFieldName[]> = {
  bireysel: ["ad", "soyad", "email"],
  kurumsal: ["alias", "email"],
  "bireysel-isletme": ["ad", "soyad", "email"],
};

export const FIELD_META: Record<
  CustomerFieldName,
  { label: string; placeholder?: string; description: string }
> = {
  ad: { label: "Ad", description: "Kişinin adı" },
  soyad: { label: "Soyad", description: "Kişinin soyadı" },
  alias: { label: "Alias", description: "Firmanın kısa adı" },
  vkn: {
    label: "VKN",
    placeholder: "10 haneli vergi kimlik no",
    description: "10 haneli vergi kimlik numarası; kartvizitte yoksa null",
  },
  ticariUnvan: {
    label: "Ticari Unvan",
    description: "Firmanın tam ticari unvanı (ör. ABC Holding A.Ş.)",
  },
  email: {
    label: "E-posta",
    placeholder: "ornek@firma.com",
    description: "E-posta adresi",
  },
};

/* ------------------------------------------------------------------ */
/* Zod şemaları (türe göre)                                            */
/* ------------------------------------------------------------------ */

const requiredText = (message: string) =>
  z.string({ required_error: message }).trim().min(1, message);

const emailField = z
  .string({ required_error: "E-posta zorunludur" })
  .trim()
  .min(1, "E-posta zorunludur")
  .email("Geçerli bir e-posta giriniz");

const sourceField = z.enum(SOURCES, {
  errorMap: () => ({ message: "Kaynak seçiniz" }),
});

const optionalVkn = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{10}$/.test(v), {
    message: "VKN 10 haneli sayısal olmalıdır",
  });

const optionalText = z.string().trim().optional();

export const bireyselSchema = z.object({
  customerType: z.literal("bireysel"),
  ad: requiredText("Ad zorunludur"),
  soyad: requiredText("Soyad zorunludur"),
  ticariUnvan: optionalText,
  email: emailField,
  kaynak: sourceField,
});

export const kurumsalSchema = z.object({
  customerType: z.literal("kurumsal"),
  alias: requiredText("Alias zorunludur"),
  vkn: optionalVkn,
  ticariUnvan: optionalText,
  email: emailField,
  kaynak: sourceField,
});

export const bireyselIsletmeSchema = z.object({
  customerType: z.literal("bireysel-isletme"),
  ad: requiredText("Ad zorunludur"),
  soyad: requiredText("Soyad zorunludur"),
  vkn: optionalVkn,
  ticariUnvan: optionalText,
  email: emailField,
  kaynak: sourceField,
});

export const customerSchemas = {
  bireysel: bireyselSchema,
  kurumsal: kurumsalSchema,
  "bireysel-isletme": bireyselIsletmeSchema,
} as const;

export const customerSchema = z.discriminatedUnion("customerType", [
  bireyselSchema,
  kurumsalSchema,
  bireyselIsletmeSchema,
]);

/** Kaydet'te servise gönderilecek payload tipi (türe göre değişir) */
export type CustomerPayload = z.infer<typeof customerSchema>;

/* ------------------------------------------------------------------ */
/* OCR servisine gönderilecek JSON Schema (türe göre değişir)          */
/* ------------------------------------------------------------------ */

function buildOcrJsonSchema(type: CustomerType) {
  const properties = Object.fromEntries(
    VISIBLE_FIELDS[type].map((name) => [
      name,
      { type: ["string", "null"], description: FIELD_META[name].description },
    ])
  );

  return {
    title: `kartvizit_${type}`,
    type: "object",
    properties,
    required: [],
    additionalProperties: false,
  };
}

export const ocrJsonSchemas: Record<CustomerType, object> = {
  bireysel: buildOcrJsonSchema("bireysel"),
  kurumsal: buildOcrJsonSchema("kurumsal"),
  "bireysel-isletme": buildOcrJsonSchema("bireysel-isletme"),
};