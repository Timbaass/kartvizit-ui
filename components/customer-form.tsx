"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, Check, Loader2, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scanBusinessCard } from "@/lib/api/card-scan";
import {
  CUSTOMER_TYPES,
  FIELD_META,
  REQUIRED_FIELDS,
  SOURCES,
  VISIBLE_FIELDS,
  bireyselIsletmeSchema,
  bireyselSchema,
  defaultValues,
  kurumsalSchema,
  type CustomerFieldName,
  type CustomerFormValues,
  type CustomerType,
} from "@/lib/schemas/customer";

/** Her tür için ayrı resolver; her çağrı kendi şemasıyla tipli. */
const resolvers = {
  bireysel: zodResolver(bireyselSchema),
  kurumsal: zodResolver(kurumsalSchema),
  "bireysel-isletme": zodResolver(bireyselIsletmeSchema),
} as unknown as Record<CustomerType, Resolver<CustomerFormValues>>;

/** Seçili müşteri türüne göre doğru resolver'ı çalıştırır. */
const resolver: Resolver<CustomerFormValues> = (values, context, options) =>
  resolvers[values.customerType](values, context, options);

export function CustomerForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver,
    defaultValues,
    mode: "onTouched",
  });

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
  } = form;

  const customerType = watch("customerType");
  const visibleFields = VISIBLE_FIELDS[customerType];
  const requiredFields = REQUIRED_FIELDS[customerType];

  // Önizleme URL'ini temizle
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setScanned(false);
  };

  const handleScan = async () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }

    setIsScanning(true);
    try {
      const result = await scanBusinessCard(file, form.getValues("customerType"));

      (Object.entries(result) as [CustomerFieldName, string][]).forEach(
        ([name, value]) =>
          form.setValue(name, value, { shouldDirty: true, shouldValidate: true })
      );
      setScanned(true);
    } catch {
      setScanned(false);
      toast.error("Kartvizit okunamadı. Bilgileri manuel girebilirsiniz.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleReset = () => {
    form.reset(defaultValues);
    setFile(null);
    setPreviewUrl(null);
    setScanned(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSubmit = (values: CustomerFormValues) => {
    // values: seçili türün şemasına göre parse edilmiş payload.
    // TODO: İstersen buradan kayıt servisine istek at.
    void values;
    toast.success("Lead başarıyla kaydedildi");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Kartvizit görseli */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-44 w-full items-center justify-center rounded-lg bg-muted p-3 text-left"
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Kartvizit önizleme"
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Camera className="h-4 w-4" />
              Kamerayı kartvizite tutun
            </span>
          )}
        </div>
        <span className="absolute bottom-4 right-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
          AI-OCR
        </span>
      </button>

      <Button
        type="button"
        className="w-full"
        onClick={handleScan}
        disabled={isScanning}
      >
        {isScanning ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Camera className="mr-2 h-4 w-4" />
        )}
        {isScanning ? "Okunuyor..." : "Kartviziti Tara"}
      </Button>

      {scanned && (
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground">
          <Check className="h-3.5 w-3.5" />
          Kartvizit tanındı — tüm alanlar düzenlenebilir
          <Pencil className="h-3 w-3" />
        </div>
      )}

      {/* Müşteri türü */}
      <FormRow label="Müşteri Türü" required htmlFor="customerType">
        <Controller
          control={control}
          name="customerType"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                if (!v) return;
                field.onChange(v);
                form.clearErrors();
              }}
            >
              <SelectTrigger id="customerType" className="w-full">
                <SelectValue>
                  {CUSTOMER_TYPES.find((t) => t.value === field.value)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormRow>

      {/* Türe göre dinamik alanlar */}
      <div className="space-y-4 border-l-2 border-border pl-3">
        {visibleFields.map((name) => (
          <FormRow
            key={name}
            label={FIELD_META[name].label}
            required={requiredFields.includes(name)}
            optional={!requiredFields.includes(name)}
            htmlFor={name}
            error={errors[name]?.message}
          >
            <Input
              id={name}
              placeholder={FIELD_META[name].placeholder}
              type={name === "email" ? "email" : "text"}
              inputMode={
                name === "vkn" ? "numeric" : name === "email" ? "email" : undefined
              }
              maxLength={name === "vkn" ? 10 : undefined}
              aria-invalid={!!errors[name]}
              {...register(name)}
            />
          </FormRow>
        ))}
      </div>

      {/* Kaynak */}
      <FormRow
        label="Kaynak"
        required
        htmlFor="kaynak"
        error={errors.kaynak?.message}
      >
        <Controller
          control={control}
          name="kaynak"
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                if (v) field.onChange(v);
              }}
            >
              <SelectTrigger
                id="kaynak"
                className="w-full"
                aria-invalid={!!errors.kaynak}
              >
                <SelectValue placeholder="Kaynak seçiniz">
                  {field.value}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormRow>

      {/* Aksiyonlar */}
      <div className="flex gap-2">
        <Button type="submit" className="flex-[2]">
          <Check className="mr-2 h-4 w-4" />
          Lead Kaydet
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={handleReset}
        >
          Tekrar Tara
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function FormRow({
  label,
  htmlFor,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {optional && (
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
            (ops.)
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}