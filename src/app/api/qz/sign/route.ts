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
      return NextResponse.json(
        { error: "Falta QZ_PRIVATE_KEY o QZ_PRIVATE_KEY_BASE64 en el servidor" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const stringToSign = typeof body?.stringToSign === "string" ? body.stringToSign : "";

    if (!stringToSign) {
      return NextResponse.json({ error: "stringToSign es requerido" }, { status: 400 });
    }

    const signer = createSign("SHA512");
    signer.update(stringToSign, "utf8");
    signer.end();

    const signature = signer.sign(privateKey, "base64");
    return NextResponse.json({ signature });
  } catch (error: any) {
    console.error("[QZ] Error firmando solicitud:", error);
    return NextResponse.json(
      { error: error?.message ?? "No fue posible firmar la solicitud" },
      { status: 500 }
    );
  }
}
