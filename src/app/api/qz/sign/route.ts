import { createSign } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function normalizarPem(valor: string): string {
  return valor.replace(/\\n/g, "\n").trim();
}

function obtenerLlavePrivada(): string {
  const keyPlain = process.env.QZ_PRIVATE_KEY;
  if (keyPlain) return normalizarPem(keyPlain);

  const keyBase64 = process.env.QZ_PRIVATE_KEY_BASE64;
  if (!keyBase64) return "";

  try {
    return normalizarPem(Buffer.from(keyBase64, "base64").toString("utf8"));
  } catch (_e) {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    const privateKey = obtenerLlavePrivada();
    if (!privateKey) {
      console.error("[QZ/Sign] Falta QZ_PRIVATE_KEY en servidor");
      return NextResponse.json(
        { error: "Falta QZ_PRIVATE_KEY o QZ_PRIVATE_KEY_BASE64 en el servidor" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const stringToSign = typeof body?.stringToSign === "string" ? body.stringToSign : "";

    if (!stringToSign) {
      console.warn("[QZ/Sign] stringToSign vacío o inválido");
      return NextResponse.json({ error: "stringToSign es requerido" }, { status: 400 });
    }

    const signer = createSign("SHA512");
    signer.update(stringToSign, "utf8");
    signer.end();

    const signature = signer.sign(privateKey, "base64");
    console.log("[QZ/Sign] ✓ Solicitud firmada exitosamente. Longitud de firma:", signature.length);
    
    return NextResponse.json({ signature });
  } catch (error: any) {
    console.error("[QZ/Sign] ✗ Error firmando solicitud:", error?.message || error);
    return NextResponse.json(
      { error: error?.message ?? "No fue posible firmar la solicitud" },
      { status: 500 }
    );
  }
}
