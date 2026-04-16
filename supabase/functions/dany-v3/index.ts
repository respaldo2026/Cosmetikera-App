// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.0";
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const phone = body?.phone;
    const name = body?.name;
    const messageBody = body?.message_body ?? body?.message ?? body?.texto;

    if (!messageBody) {
      return new Response(JSON.stringify({ error: "message_body requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!supabaseUrl || !supabaseKey || !geminiKey) {
      return new Response(JSON.stringify({ error: "Faltan variables de entorno" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Estado por lead (para recordar último curso y responder más corto)
    let leadState: { last_curso_id?: number | null } | null = null;
    if (phone) {
      const { data: stateData, error: stateErr } = await supabase
        .from("lead_state")
        .select("last_curso_id")
        .eq("phone", phone)
        .maybeSingle();
      if (!stateErr && stateData) {
        leadState = stateData;
      }
    }

    // 0. Obtener prompt del agente (si existe)
    let agentPrompt: string | null = null;
    const { data: agentData, error: agentErr } = await supabase
      .from("agent_settings")
      .select("system_prompt")
      .eq("id", 1)
      .maybeSingle();
    if (!agentErr && agentData?.system_prompt) {
      agentPrompt = agentData.system_prompt;
    }

    // 1. Obtener ofertas (cursos/grupos) desde el Centro de Marketing
    const { data: marketing, error: marketingErr } = await supabase
      .from("marketing_centro")
      .select("*, urls_adjuntos")
      .in("estado", ["activo", "proximo"])
      .order("fecha_inicio", { ascending: true })
      .limit(50);

    if (marketingErr) {
      console.error("Error marketing_centro", marketingErr);
    }

    // 2. Obtener materiales visibles para IA como respaldo
    const { data: assets, error: assetsErr } = await supabase
      .from("marketing_assets")
      .select("titulo, descripcion_ia, url_archivo, tipo_asset, categoria, keywords")
      .eq("visible_para_ia", true)
      .order("created_at", { ascending: false })
      .limit(30);

    // 3. Documentos indexados para el agente (resumenes)
    const { data: agentDocs, error: docsErr } = await supabase
      .from("agent_documents")
      .select("title, summary, keywords")
      .order("created_at", { ascending: false })
      .limit(20);
    if (docsErr) {
      console.error("Error agent_documents", docsErr);
    }

    // 4. Recuperar chunks por similitud (embedding) para el mensaje
    const fetchSimilarChunks = async () => {
      try {
        const embedModel = new GoogleGenerativeAI(geminiKey).getGenerativeModel({ model: "text-embedding-004" });
        const embedRes = await embedModel.embedContent(messageBody.slice(0, 2000));
        const queryEmbedding = embedRes.embedding.values;

        const { data, error } = await supabase.rpc("match_agent_chunks", {
          query_embedding: queryEmbedding,
          match_count: 5,
          similarity_threshold: 0.6,
        });
        if (error) {
          console.error("match_agent_chunks error", error);
          return [] as any[];
        }
        return data ?? [];
      } catch (e) {
        console.error("embedding retrieval error", e);
        return [] as any[];
      }
    };

    const similarChunks = await fetchSimilarChunks();

    if (assetsErr) {
      console.error("Error marketing_assets", assetsErr);
    }

    const contextLines = (marketing ?? []).map((m) => {
      const precio = m.precio_promocional ?? m.precio_lista ?? "s/p";
      const inicio = m.fecha_inicio ?? "fecha por definir";
      const cupos = m.cupos_disponibles ?? "cupos N/D";
      const horario = m.hora_inicio && m.hora_fin ? `${m.hora_inicio} - ${m.hora_fin}` : "hora por definir";
      const adjuntos = m.urls_adjuntos && Array.isArray(m.urls_adjuntos)
        ? m.urls_adjuntos.map((a) => `${a.label ?? "adjunto"}: ${a.url ?? ""}`).join(" | ")
        : "";
      const medios = [m.url_foto, m.url_video].filter(Boolean).join(" | ");
      return `- ${m.titulo} (${m.tipo}) | inicio: ${inicio} ${horario ? "| " + horario : ""} | precio: ${precio} ${m.moneda ?? ""} | cupos: ${cupos} | estado: ${m.estado} | inscripciones: ${m.url_inscripcion ?? "N/A"}${medios ? " | medios: " + medios : ""}${adjuntos ? " | adjuntos: " + adjuntos : ""}`;
    });

    const materialsLines = (assets ?? []).map((a) => {
      const kws = a.keywords && Array.isArray(a.keywords) ? ` | keywords: ${a.keywords.join(", ")}` : "";
      return `- ${a.titulo} [${a.tipo_asset}] ${a.descripcion_ia ?? ""} | url: ${a.url_archivo ?? "N/A"}${kws}`;
    });

    const agentDocsLines = (agentDocs ?? []).map((d) => {
      const kws = d.keywords && Array.isArray(d.keywords) ? ` | keywords: ${d.keywords.join(", ")}` : "";
      return `- ${d.title}: ${d.summary ?? "(sin resumen)"}${kws}`;
    });

    const chunkLines = (similarChunks ?? []).map((c: any) => `- ${c.content?.slice(0, 280) ?? ""}`);

    if ((!marketing || marketing.length === 0) && (!assets || assets.length === 0)) {
      return new Response(
        JSON.stringify({ reply: "No tengo cursos ni materiales cargados en este momento. Dime qué curso te interesa y lo consulto con un asesor." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const promptBase =
      agentPrompt ||
      "Eres Dany, asistente de la academia. Responde solo con los datos disponibles; si algo falta, di que lo consultas con un asesor y NO inventes ni uses frases como 'algo salió mal con mi cerebro'. Prioriza precios, fechas, horarios, cupos y links solo si están en el contexto. Si no están, di que consultarás a un asesor.";

    const prompt = [
      promptBase,
      "Contexto cursos/grupos:",
      contextLines.join("\n") || "(sin cursos activos/próximos)",
      "Contexto materiales:",
      materialsLines.join("\n") || "(sin materiales IA)",
      "Contexto documentos (resúmenes):",
      agentDocsLines.join("\n") || "(sin documentos)",
      "Contexto recuperado (chunks relevantes):",
      chunkLines.join("\n") || "(sin resultados de búsqueda)",
      "Pregunta del usuario:",
      messageBody,
    ]
      .filter(Boolean)
      .join("\n\n");

    const sanitize = (text: string) =>
      text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const msg = sanitize(messageBody);
    const wantsMedia = /foto|imagen|video|adjunto|material|brochure/.test(msg);
    const wantsDuration = /duracion|dura/.test(msg);
    const wantsPrice = /precio|costo|vale|inversion/.test(msg);
    const wantsSchedule = /hora|horario/.test(msg);
    const wantsAll = /info|informacion|detalle|completo/.test(msg);
    const isGreeting = /\b(hola|buenas|hello|hey|hi)\b/.test(msg);
    const stopWords = new Set([
      "curso",
      "cursos",
      "clase",
      "clases",
      "de",
      "del",
      "para",
      "una",
      "unas",
      "unos",
      "un",
      "hola",
      "buenas",
      "hello",
      "hey",
      "hi",
    ]);
    const palabrasClave = msg
      .split(/\W+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const scoreCurso = (curso: any) => {
      if (!curso) return -1;
      let score = 0;
      const tituloSan = sanitize(curso.titulo ?? "");
      const tipoSan = sanitize(curso.tipo ?? "");
      const slugSan = sanitize(curso.slug ?? "");
      const descSan = sanitize(curso.descripcion_corta ?? "");
      const descIaSan = sanitize(curso.descripcion_ia ?? "");
      const kwsSan = Array.isArray(curso.keywords) ? curso.keywords.map((k: string) => sanitize(String(k))) : [];

      palabrasClave.forEach((w) => {
        if (tituloSan.includes(w)) score += 2;
        if (descSan.includes(w)) score += 2;
        if (descIaSan.includes(w)) score += 2;
        if (slugSan.includes(w)) score += 1;
        if (tipoSan.includes(w)) score += 0.5;
        if (kwsSan.some((kw) => kw.includes(w))) score += 2;
      });

      if (wantsMedia && (curso.url_foto || curso.url_video || (curso.urls_adjuntos && curso.urls_adjuntos.length))) score += 2;
      if (wantsPrice) score += 1;
      if (wantsSchedule) score += 1;
      if (wantsDuration) score += 1;

      return score;
    };

    const construirRespuestaVendedora = (curso: any) => {
      if (!curso) return null;

      const precioOferta = curso.precio_promocional ?? curso.precio_lista;
      const precioLista = curso.precio_lista && curso.precio_promocional ? `${curso.precio_lista} ${curso.moneda ?? ""}`.trim() : "";
      const precioTexto = precioOferta ? `${precioOferta} ${curso.moneda ?? ""}`.trim() : "Te confirmo el precio en un momento.";
      const mensualidadTexto = curso.precio_mensualidad
        ? `${curso.precio_mensualidad} ${curso.moneda ?? ""}`.trim()
        : "Te confirmo la mensualidad en un momento.";

      const inicio = curso.fecha_inicio ?? "(te confirmo fecha exacta en un momento)";
      const cupos = curso.cupos_disponibles;
      const horario = curso.hora_inicio && curso.hora_fin ? `${curso.hora_inicio} - ${curso.hora_fin}` : "(te confirmo el horario enseguida)";
      const link = curso.url_inscripcion ?? "(te paso el enlace apenas lo tenga)";

      const cuposTexto =
        typeof cupos === "number"
          ? cupos <= 5
            ? `🔥 Quedan ${cupos} cupos, suele llenarse rápido.`
            : `Cupos disponibles: ${cupos}.`
          : "Verifico cupos contigo en un minuto.";

      const saludo = name ? `👋 Hola ${name}, soy Dany del equipo Crystal Diamante ✨` : "👋 Hola, soy Dany del equipo Crystal Diamante ✨";
      const tonoHumano = "Estoy aquí para ayudarte rápido y bien.";

      const extras: string[] = [];
      if (curso.descripcion_corta && (wantsAll || wantsDuration)) {
        extras.push(`ℹ️ ${curso.descripcion_corta}`);
      }
      if (wantsSchedule && horario && !curso.descripcion_corta) {
        extras.push(`⏰ Horario: ${horario}`);
      }
      if (wantsMedia) {
        if (curso.url_foto) extras.push(`📸 Foto: ${curso.url_foto}`);
        if (curso.url_video) extras.push(`🎥 Video: ${curso.url_video}`);
        if (curso.urls_adjuntos && Array.isArray(curso.urls_adjuntos)) {
          curso.urls_adjuntos.forEach((a: any) => {
            if (a?.url) extras.push(`📎 ${a?.label ?? "Adjunto"}: ${a.url}`);
          });
        }
      }

      const respuestaCorta = () => {
        const partes: string[] = [`${saludo}`, tonoHumano, ""];
        if (wantsSchedule) partes.push(`📆 *Inicio:* ${inicio}${horario ? ` | ⏰ *Horario:* ${horario}` : ""}`);
        if (wantsPrice) {
          partes.push(`💰 *Inscripción/curso:* ${precioTexto}${precioLista ? ` (normal ${precioLista})` : ""}`);
          partes.push(`📅 *Mensualidad:* ${mensualidadTexto}`);
        }
        if (wantsDuration || wantsAll) {
          if (curso.descripcion_corta) partes.push(`ℹ️ ${curso.descripcion_corta}`);
          else partes.push("ℹ️ Ese detalle no lo tengo cargado, te lo confirmo ya mismo.");
        }
        if (wantsMedia) {
          let anyMedia = false;
          if (curso.url_foto) {
            partes.push(`📸 Foto: ${curso.url_foto}`);
            anyMedia = true;
          }
          if (curso.url_video) {
            partes.push(`🎥 Video: ${curso.url_video}`);
            anyMedia = true;
          }
          if (curso.urls_adjuntos && Array.isArray(curso.urls_adjuntos)) {
            curso.urls_adjuntos.forEach((a: any) => {
              if (a?.url) {
                partes.push(`📎 ${a?.label ?? "Adjunto"}: ${a.url}`);
                anyMedia = true;
              }
            });
          }
          if (!anyMedia) {
            partes.push("No tengo foto/video cargado aquí, te lo paso en seguida.");
          }
        }
        if (partes.length <= 3) {
          // Si no se pidió nada específico, regresar null para usar la completa
          return null;
        }
        partes.push("", `🔗 ${link}`, "¿Te ayudo con algo más de este curso?");
        return partes.filter(Boolean).join("\n");
      };

      const corta = respuestaCorta();
      if (corta) return corta;

      return [
        `${saludo}`,
        tonoHumano,
        "",
        `💎 *${curso.titulo}*`,
        `📆 *Inicio:* ${inicio}${horario ? ` | ⏰ *Horario:* ${horario}` : ""}`,
        `💰 *Inscripción/curso:* ${precioTexto}${precioLista ? ` (normal ${precioLista})` : ""}`,
        `📅 *Mensualidad:* ${mensualidadTexto}`,
        `🎯 ${cuposTexto}`,
        wantsMedia ? "" : `🔗 Asegura tu cupo: ${link}`,
        ...extras,
        "",
        "¿Te ayudo a reservar ya mismo o prefieres que te cuente un detalle más?",
      ]
        .filter(Boolean)
        .join("\n");
    };

    // Respuesta determinista sin Gemini para evitar frases no deseadas
    const mejor = (marketing ?? []).reduce<{ curso: any; score: number } | null>((best, curso) => {
      const score = scoreCurso(curso);
      if (!best || score > best.score) return { curso, score };
      return best;
    }, null);

    const cursoFromState = leadState?.last_curso_id
      ? (marketing ?? []).find((c: any) => c.id === leadState?.last_curso_id)
      : null;

    const pick = mejor && mejor.score > 0 ? mejor.curso : cursoFromState ?? null;

    let reply = "";
    if (pick) {
      reply = construirRespuestaVendedora(pick) ?? "";
    }

    if (!reply && wantsMedia) {
      const conMedios = (marketing ?? []).find((c) => c.url_foto || c.url_video || (c.urls_adjuntos && c.urls_adjuntos.length));
      reply = construirRespuestaVendedora(conMedios) ?? "";
    }

    if (!reply && wantsSchedule && marketing && marketing.length > 0) {
      // Si preguntan por días/horario y no hubo match por keywords, responde con el primero activo
      reply = construirRespuestaVendedora(marketing[0]) ?? "";
    }

    if (!reply && isGreeting) {
      const saludo = name ? `👋 Hola ${name}, soy Dany del equipo Crystal Diamante ✨` : "👋 Hola, soy Dany del equipo Crystal Diamante ✨";
      const titulos = (marketing ?? []).map((c) => c.titulo).filter(Boolean).slice(0, 3);
      const lineaCursos = titulos.length > 0 ? `Tengo ${titulos.join(", ")}.` : "";
      reply = [saludo, "Estoy aquí para ayudarte rápido y bien.", lineaCursos ? `${lineaCursos} Dime el curso o si buscas precio/horario y te respondo al toque.` : "Cuéntame qué curso te interesa o si quieres precio/horario y te respondo al toque."]
        .filter(Boolean)
        .join("\n");
    }

    if (!reply && marketing && marketing.length > 0) {
      const listado = marketing.slice(0, 3).map((c) => {
        const precioLinea = c.precio_promocional ?? c.precio_lista ?? "s/p";
        const linkLinea = c.url_inscripcion ?? "(pide el enlace)";
        return `- ${c.titulo} | ${precioLinea} ${c.moneda ?? ""} | ${linkLinea}`;
      });
      reply = [
        "No encuentro un curso exacto a lo que pides, pero estas opciones están activas:",
        ...listado,
        "¿Cuál te interesa y te paso más detalles?",
      ]
        .filter(Boolean)
        .join("\n");
    }

    if (!reply) {
      reply = materialsLines[0] ?? "No tengo datos suficientes ahora; te conecto con un asesor.";
    }

    // Guardar estado de lead
    if (phone && pick?.id) {
      await supabase
        .from("lead_state")
        .upsert({ phone, last_curso_id: pick.id, last_updated: new Date().toISOString() });
    }

    // Filtro final anti-frase prohibida
    const bannedRegex = /(cerebro|algo\s+sal[ií]o\s+mal|brain)/i;
    const sanitizedReply = sanitize(reply ?? "");
    if (!reply || bannedRegex.test(reply) || bannedRegex.test(sanitizedReply)) {
      reply = "No tengo datos suficientes ahora; te conecto con un asesor para confirmarte precios, fechas y cupos.";
    }

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error dany-v3", error);
    return new Response(JSON.stringify({ error: error?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});