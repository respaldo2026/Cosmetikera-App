export type AgentIntent = "precio" | "horario" | "temario" | "materiales" | "inscripcion" | "requisitos" | "general";

export interface AgentImageSuggestion {
  type: "image";
  mediaUrl: string;
  caption: string;
  sendBeforeText: true;
  intent: AgentIntent;
  assetId: string;
  source: "marketing_assets";
}

type MarketingAssetCandidate = {
  id: string;
  titulo?: string | null;
  descripcion?: string | null;
  descripcion_ia?: string | null;
  tipo_asset?: string | null;
  url_archivo?: string | null;
  keywords?: string[] | string | null;
  categoria?: string | null;
  programa_id?: number | null;
  estado?: string | null;
  visible_para_ia?: boolean | null;
  created_at?: string | null;
};

function normalizeText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => normalizeText(String(item || "")))
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    return raw
      .split(/[,;|]/)
      .map((item) => normalizeText(item))
      .filter(Boolean);
  }

  return [];
}

function getIntentCategoryHints(intent: AgentIntent): string[] {
  if (intent === "horario") return ["horarios", "informativo"];
  if (intent === "precio") return ["precios", "promocional", "inscripción"];
  if (intent === "inscripcion") return ["inscripción", "promocional"];
  if (intent === "temario") return ["informativo"];
  if (intent === "materiales") return ["informativo"];
  return ["informativo", "promocional"];
}

function getIntentKeywordHints(intent: AgentIntent): string[] {
  if (intent === "horario") return ["horario", "horarios", "fecha", "inicio", "grupo", "clase"];
  if (intent === "precio") return ["precio", "precios", "inversion", "inscripcion", "mensualidad"];
  if (intent === "inscripcion") return ["inscripcion", "matricula", "admisiones", "cupo"];
  if (intent === "temario") return ["temario", "contenido", "ciclos", "modulos", "curso"];
  if (intent === "materiales") return ["materiales", "kit", "insumos", "implementos"];
  return ["academia", "clases", "estudiantes"];
}

function isImageLikeAsset(asset: MarketingAssetCandidate): boolean {
  const type = normalizeText(String(asset.tipo_asset || ""));
  return type === "imagen" || type === "flyer" || type === "image" || type === "foto";
}

function isAssetAvailable(asset: MarketingAssetCandidate): boolean {
  const url = String(asset.url_archivo || "").trim();
  if (!url) return false;

  if (asset.visible_para_ia === false) return false;

  const estado = normalizeText(String(asset.estado || "activo"));
  if (estado.includes("inactivo") || estado.includes("eliminado") || estado.includes("archivado")) {
    return false;
  }

  return true;
}

function buildTrustCaption(asset: MarketingAssetCandidate): string {
  const title = String(asset.titulo || "").trim();
  if (title) {
    return `${title} ✨`;
  }

  const description = String(asset.descripcion || asset.descripcion_ia || "").trim();
  if (description) {
    return `${description.slice(0, 120)}${description.length > 120 ? "..." : ""}`;
  }

  return "Así vivimos las clases en Academia Crystal ✨";
}

// Patrones que NUNCA deben disparar una imagen
const GREETING_BLOCK_PATTERN = /^(hola|hi|hey|buenos?\s*d[ií]as?|buenas?\s*(tardes?|noches?)|hello|holi|saludos?|qu[eé]\s+tal|c[oó]mo\s+est[aá]s?)[\s!.]*$/i;
const SHORT_AFFIRMATIVE_BLOCK_PATTERN = /^(si|sí|s+i+p*|ok|okay|okey|dale|listo|claro|perfecto|de\s+una|bien|ya|sip|okok|entendido|genial|excelente|por\s+supuesto|claro\s+que\s+si|aha|mhm|mhmm)[\s!.?]*$/i;
const GENERIC_INFO_BLOCK_PATTERN = /^(informaci[oó]n|m[aá]s\s+info|info|quiero\s+(saber|m[aá]s)|quiero\s+informaci[oó]n)[\s!.?]*$/i;

export async function getAgentImageSuggestion(
  supabase: any,
  params: {
    message: string;
    intent: AgentIntent;
    programId?: number | null;
    /** URLs de imágenes ya enviadas en esta conversación — se excluyen para no repetir */
    excludeUrls?: string[];
  }
): Promise<AgentImageSuggestion | null> {
  try {
    const normalizedMessage = normalizeText(params.message || "");
    if (!normalizedMessage) return null;

    // Bloquear imágenes en saludos, afirmaciones cortas y solicitudes genéricas de info
    const rawMessage = (params.message || "").trim();
    if (
      GREETING_BLOCK_PATTERN.test(rawMessage) ||
      SHORT_AFFIRMATIVE_BLOCK_PATTERN.test(rawMessage) ||
      GENERIC_INFO_BLOCK_PATTERN.test(rawMessage)
    ) {
      return null;
    }

    // Si la intención es general, requerir que el mensaje tenga al menos 4 tokens con significado
    if (params.intent === "general") {
      const meaningfulTokens = normalizedMessage.split(" ").filter((t) => t.length >= 4);
      if (meaningfulTokens.length < 2) return null;
    }

    const messageTokens = new Set(
      normalizedMessage
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
    );

    const { data, error } = await supabase
      .from("marketing_assets")
      .select("id, titulo, descripcion, descripcion_ia, tipo_asset, url_archivo, keywords, categoria, programa_id, estado, visible_para_ia, created_at")
      .limit(200);

    if (error || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const categoryHints = getIntentCategoryHints(params.intent).map((value) => normalizeText(value));
    const intentKeywordHints = getIntentKeywordHints(params.intent).map((value) => normalizeText(value));
    const candidates = (data as MarketingAssetCandidate[])
      .filter((asset) => isImageLikeAsset(asset) && isAssetAvailable(asset));

    // Excluir imágenes ya enviadas en esta conversación para evitar repetición
    const excludeSet = new Set((params.excludeUrls || []).map((u) => u.trim()));
    const freshCandidates = excludeSet.size > 0
      ? candidates.filter((asset) => !excludeSet.has(String(asset.url_archivo || "").trim()))
      : candidates;

    // Si todas las imágenes disponibles ya fueron enviadas, no enviar ninguna
    // (evita repetición; es mejor no enviar imagen que enviar la misma siempre)
    const candidatesToRank = freshCandidates.length > 0 ? freshCandidates : (candidates.length > 0 && excludeSet.size === 0 ? candidates : null);

    if (!candidatesToRank || candidatesToRank.length === 0) {
      return null;
    }

    const ranked = candidatesToRank
      .map((asset) => {
        const keywords = extractKeywords(asset.keywords);
        const category = normalizeText(String(asset.categoria || ""));
        const searchable = normalizeText(
          [
            asset.titulo || "",
            asset.descripcion || "",
            asset.descripcion_ia || "",
            keywords.join(" "),
            category,
          ].join(" ")
        );

        let score = 0;

        if (params.programId && Number(asset.programa_id) === Number(params.programId)) {
          score += 40;
        }

        if (params.intent === "general") {
          score += 2;
        }

        if (category && categoryHints.includes(category)) {
          score += 25;
        }

        for (const hint of intentKeywordHints) {
          if (!hint) continue;
          if (searchable.includes(hint)) score += 10;
        }

        for (const token of messageTokens) {
          if (searchable.includes(token)) score += 4;
        }

        return { asset, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(String(b.asset.created_at || 0)).getTime() - new Date(String(a.asset.created_at || 0)).getTime();
      });

    // Solo devolver imagen si hay un puntaje mínimo de relevancia
    // Para intención "general" se exige más puntos (obliga a tener match de programa + categoría)
    const MINIMUM_SCORE = params.intent === "general" ? 40 : 15;
    
    const bestRanked = ranked[0];
    
    // Si el mejor puntaje es menor al mínimo, no devolver imagen
    if (!bestRanked || bestRanked.score < MINIMUM_SCORE) {
      return null;
    }

    const best = bestRanked.asset;
    if (!best?.url_archivo) {
      return null;
    }

    return {
      type: "image",
      mediaUrl: String(best.url_archivo),
      caption: buildTrustCaption(best),
      sendBeforeText: true,
      intent: params.intent,
      assetId: String(best.id),
      source: "marketing_assets",
    };
  } catch (_error) {
    return null;
  }
}

export function withMediaSuggestion<T extends Record<string, any>>(
  payload: T,
  mediaSuggestion: AgentImageSuggestion | null
): T & {
  media_suggestion?: AgentImageSuggestion;
  media_send_order?: "image_then_text";
} {
  if (!mediaSuggestion) {
    return payload;
  }

  return {
    ...payload,
    media_suggestion: mediaSuggestion,
    media_send_order: "image_then_text",
  };
}