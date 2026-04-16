"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  message,
  Tag,
  Typography,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Tooltip,
  Switch,
  Image,
  Grid,
  Divider,
  Alert,
  Tabs,
  Dropdown,
  Skeleton,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import { supabaseBrowserClient } from "@utils/supabase/client";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface MarketingAsset {
  id: string;
  titulo: string;
  descripcion?: string;
  tipo_asset: string;
  url_archivo: string;
  nombre_archivo: string;
  tamano_bytes?: number;
  mime_type?: string;
  descripcion_ia: string;
  keywords?: string[];
  programa_id?: number;
  curso_id?: number;
  estado: string;
  visible_para_ia: boolean;
  categoria?: string;
  created_at: string;
  updated_at: string;
}

interface Programa {
  id: number;
  nombre: string;
}

interface MarketingCurso {
  id: number;
  titulo: string;
  tipo?: string;
  estado?: string;
  fecha_inicio?: string | null;
  keywords?: string[];
}

interface CursoProximo {
  id: number;
  nombre: string;
  fecha_inicio: string;
  cupos?: number;
  estado?: string;
  dias_semana?: string[] | string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  programas?: { nombre: string }[] | null;
}

const tipoAssetOptions = [
  { value: "flyer", label: "Flyer", icon: <FileImageOutlined /> },
  { value: "pdf", label: "PDF", icon: <FilePdfOutlined /> },
  { value: "imagen", label: "Imagen", icon: <FileImageOutlined /> },
  { value: "video", label: "Video" },
  { value: "documento", label: "Documento", icon: <FileOutlined /> },
  { value: "otro", label: "Otro" },
];

const categoriaOptions = [
  "promocional",
  "informativo",
  "legal",
  "inscripción",
  "horarios",
  "precios",
];

const DEFAULT_AGENT_SYSTEM_PROMPT = `# System Prompt: Agente {{persona_name}} (v4.0 – Conversación Humana + Precisión)

🧠 Identidad
Eres {{persona_name}}, {{persona_bio}}.
Tu objetivo es orientar con claridad y naturalidad para ayudar a la inscripción, sin sonar robótico.

## 1) Prioridad de conversación (OBLIGATORIO)
1. Responde la intención ACTUAL del usuario.
2. No repitas el mismo bloque si la persona ya avanzó.
3. Si el usuario corrige ("eso no es..."), corrige de inmediato y no insistas en el programa anterior.
4. Si el usuario dice "sí/ok/sii", continúa el tema pendiente (no reinicies información general).
5. Si el usuario dice "gracias", responde corto y humano; puedes compartir redes para más info.

## 2) Estilo WhatsApp
{{greeting_rule}}
- Usa párrafos cortos y escaneables.
- Usa negrita para datos clave (curso, precio, fecha, horario).
- Mantén tono cercano y profesional.
- Estilo preferido: {{speaking_style}}

## 3) Reglas de negocio
- No inventes datos. Si falta información, usa: "{{fallback_response}}".
- Si piden precio: prioriza inscripción + mensualidad (no total salvo que lo pidan).
- Si piden ubicación: responde dirección/referencia primero.
- Si preguntan por un programa no disponible: dilo claro y ofrece alternativas reales.
- Formato de hora en AM/PM.

## 4) Flujo comercial natural (sin rigidez)
- No uses un guion fijo de 3 pasos.
- Avanza según lo que la persona pregunte: precio, horario, ubicación, pensum, materiales o inscripción.
- Cierra con una sola pregunta de avance (máximo una).

## 5) Redes y cierre humano
- En respuestas de valor (precio, fechas, contenido, ubicación), puedes cerrar con redes:
  "Si quieres más info, también te comparto nuestras redes".
- No fuerces venta tras un "gracias".

## 6) Contacto de admisiones
📱 WhatsApp Admisiones: +57 301 203 8582
Compártelo cuando haya intención clara de inscripción o cuando lo pidan.

## 7) Reglas no negociables
- Solo usa información explícita del contexto jerárquico.
- Si un curso no aparece en contexto, di que no está disponible.
- No inventes horarios, precios, fechas ni nombres.

{{sales_protocol}}
`;

const estadoColors: Record<string, string> = {
  activo: "green",
  inactivo: "orange",
  archivado: "default",
};

export default function MarketingCenterPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [cursosMarketing, setCursosMarketing] = useState<MarketingCurso[]>([]);
  const [cursosProximos, setCursosProximos] = useState<CursoProximo[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string | undefined>(undefined);
  const [filterCategoria, setFilterCategoria] = useState<string | undefined>(undefined);
  const [soloIA, setSoloIA] = useState(false);
  const [mostrarContextoIA, setMostrarContextoIA] = useState(false);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MarketingAsset | null>(null);
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [keywordsDraft, setKeywordsDraft] = useState<Record<number, string>>({});
  const [savingCursoId, setSavingCursoId] = useState<number | null>(null);
  const [loadingCursosMarketing, setLoadingCursosMarketing] = useState(false);
  const [iaModalVisible, setIaModalVisible] = useState(false);
  const [iaTargetCurso, setIaTargetCurso] = useState<MarketingCurso | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResult, setIaResult] = useState<{ promo?: string; keywords?: string[] }>({});
  const [iaError, setIaError] = useState<string | null>(null);
  const [iaForm] = Form.useForm();
  const [agentForm] = Form.useForm();
  const [loadingAgentPrompt, setLoadingAgentPrompt] = useState(false);
  const [savingAgentPrompt, setSavingAgentPrompt] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestForm] = Form.useForm();
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null);
  const [activeTabKey, setActiveTabKey] = useState("agent");
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const getAgentPromptTextArea = () => {
    if (typeof document === "undefined") return null;
    return document.getElementById("agent-system-prompt") as HTMLTextAreaElement | null;
  };

  const applyWhatsappFormatToPrompt = (prefix: string, suffix = prefix, placeholder = "texto") => {
    const currentValue = (agentForm.getFieldValue("system_prompt") as string) || "";
    const textArea = getAgentPromptTextArea();
    const selectionStart = textArea?.selectionStart ?? currentValue.length;
    const selectionEnd = textArea?.selectionEnd ?? currentValue.length;
    const hasSelection = selectionEnd > selectionStart;
    const selectedText = hasSelection ? currentValue.slice(selectionStart, selectionEnd) : placeholder;
    const formattedText = `${prefix}${selectedText}${suffix}`;

    const nextValue =
      currentValue.slice(0, selectionStart) +
      formattedText +
      currentValue.slice(selectionEnd);

    agentForm.setFieldsValue({ system_prompt: nextValue });

    requestAnimationFrame(() => {
      const nextTextArea = getAgentPromptTextArea();
      if (!nextTextArea) return;
      nextTextArea.focus();
      const nextSelectionStart = selectionStart + prefix.length;
      const nextSelectionEnd = nextSelectionStart + selectedText.length;
      nextTextArea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  };

  const insertIntoPrompt = (text: string) => {
    const currentValue = (agentForm.getFieldValue("system_prompt") as string) || "";
    const textArea = getAgentPromptTextArea();
    const selectionStart = textArea?.selectionStart ?? currentValue.length;
    const selectionEnd = textArea?.selectionEnd ?? currentValue.length;

    const nextValue =
      currentValue.slice(0, selectionStart) +
      text +
      currentValue.slice(selectionEnd);

    agentForm.setFieldsValue({ system_prompt: nextValue });

    requestAnimationFrame(() => {
      const nextTextArea = getAgentPromptTextArea();
      if (!nextTextArea) return;
      const nextCursorPosition = selectionStart + text.length;
      nextTextArea.focus();
      nextTextArea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const restaurarPromptPorDefecto = () => {
    Modal.confirm({
      title: "¿Restaurar prompt por defecto?",
      content: "Esto reemplazará el contenido actual del prompt en el formulario.",
      okText: "Restaurar",
      cancelText: "Cancelar",
      onOk: () => {
        agentForm.setFieldsValue({ system_prompt: DEFAULT_AGENT_SYSTEM_PROMPT });
        message.success("Prompt por defecto cargado. Pulsa Guardar para aplicarlo.");
      },
    });
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      await Promise.all([
        cargarProgramas(),
        cargarCursosProximos(),
        cargarMarketingCursos(),
        cargarAgentPrompt(),
        cargarDocs(),
      ]);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTabKey(key);
    if (key === "assets" && !assetsLoaded) {
      cargarAssets();
    }
  };

  const handleToggleContextoIA = () => {
    setMostrarContextoIA((prev) => {
      const next = !prev;
      if (next && !assetsLoaded) {
        cargarAssets();
      }
      return next;
    });
  };

  const cargarDatos = async () => {
    await Promise.all([
      cargarAssets(),
      cargarProgramas(),
      cargarCursosProximos(),
      cargarMarketingCursos(),
      cargarAgentPrompt(),
      cargarDocs(),
    ]);
  };

  const cargarAssets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("marketing_assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets((data as MarketingAsset[]) || []);
      setAssetsLoaded(true);
    } catch (error: any) {
      console.error("Error cargando assets:", error);
      message.error("No se pudieron cargar los assets de marketing");
    } finally {
      setLoading(false);
    }
  };

  const cargarProgramas = async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("programas")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;
      setProgramas((data as Programa[]) || []);
    } catch (error) {
      console.error("Error cargando programas:", error);
    }
  };

  const cargarCursosProximos = async () => {
    try {
      const hoy = dayjs().format("YYYY-MM-DD");
      const { data, error } = await supabaseBrowserClient
        .from("cursos")
        .select("id, nombre, fecha_inicio, cupos, estado, dias_semana, hora_inicio, hora_fin, programas(nombre)")
        .gte("fecha_inicio", hoy)
        .in("estado", ["proximo", "activo"])
        .order("fecha_inicio", { ascending: true })
        .limit(12);

      if (error) throw error;
      const normalizados = (data || []).map((c: any) => ({
        ...c,
        programas: Array.isArray(c.programas) ? c.programas : c.programas ? [c.programas] : [],
        dias_semana: c.dias_semana ?? null,
      }));
      setCursosProximos(normalizados as CursoProximo[]);
    } catch (error) {
      console.error("Error cargando cursos próximos:", error);
      message.error("No se pudieron cargar los cursos próximos");
    }
  };

  const handleUpload = async (values: any) => {
    console.log("[MARKETING] Iniciando subida con valores:", values);
    console.log("[MARKETING] FileList length:", fileList.length);
    console.log("[MARKETING] EditingAsset:", editingAsset);

    if (fileList.length === 0 && !editingAsset) {
      message.error("Debes seleccionar un archivo");
      return;
    }

    setUploading(true);
    try {
      let urlArchivo = editingAsset?.url_archivo;
      let nombreArchivo = editingAsset?.nombre_archivo;
      let tamanoBytes = editingAsset?.tamano_bytes;
      let mimeType = editingAsset?.mime_type;

      // Si hay un archivo nuevo, subirlo
      if (fileList.length > 0) {
        const fileItem = fileList[0];
        console.log("[MARKETING] FileItem:", fileItem);
        
        // El fileItem puede ser un File directamente o un UploadFile con originFileObj
        const file = (fileItem instanceof File) 
          ? fileItem 
          : (fileItem as any)?.originFileObj as File | undefined;
        
        if (!file) {
          console.error("[MARKETING] No se pudo extraer el archivo");
          message.error("No se pudo leer el archivo seleccionado");
          setUploading(false);
          return;
        }

        console.log("[MARKETING] Archivo a subir:", {
          name: file.name,
          size: file.size,
          type: file.type
        });

        const fileExt = file.name.split(".").pop() || "bin";
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        console.log("[MARKETING] Subiendo a Storage, path:", filePath);

        // Subir a Supabase Storage (bucket 'marketing')
        const { data: uploadData, error: uploadError } = await supabaseBrowserClient.storage
          .from("marketing")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        console.log("[MARKETING] Resultado de upload:", { uploadData, uploadError });

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const {
          data: { publicUrl },
        } = supabaseBrowserClient.storage.from("marketing").getPublicUrl(filePath);

        console.log("[MARKETING] URL pública obtenida:", publicUrl);

        urlArchivo = publicUrl;
        nombreArchivo = file.name;
        tamanoBytes = file.size;
        mimeType = file.type;
      }

      // Preparar datos para guardar
      const payload = {
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        tipo_asset: values.tipo_asset,
        url_archivo: urlArchivo,
        nombre_archivo: nombreArchivo,
        tamano_bytes: tamanoBytes,
        mime_type: mimeType,
        descripcion_ia: values.descripcion_ia,
        keywords: values.keywords ? values.keywords.split(",").map((k: string) => k.trim()) : [],
        programa_id: values.programa_id || null,
        curso_id: values.curso_id || null,
        estado: values.estado || "activo",
        visible_para_ia: values.visible_para_ia !== false,
        categoria: values.categoria || null,
      };

      if (editingAsset) {
        // Actualizar
        const { error } = await supabaseBrowserClient
          .from("marketing_assets")
          .update(payload)
          .eq("id", editingAsset.id);

        if (error) throw error;
        message.success("Asset actualizado correctamente");
      } else {
        // Crear
        const { error } = await supabaseBrowserClient.from("marketing_assets").insert(payload);

        if (error) throw error;
        message.success("Asset creado correctamente");
      }

      setModalVisible(false);
      form.resetFields();
      setFileList([]);
      setEditingAsset(null);
      cargarAssets();
    } catch (error: any) {
      console.error("Error guardando asset:", error);
      message.error(error.message || "Error al guardar el asset");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (record: MarketingAsset) => {
    setEditingAsset(record);
    form.setFieldsValue({
      ...record,
      keywords: record.keywords?.join(", ") || "",
    });
    setModalVisible(true);
  };

  const handleDelete = async (record: MarketingAsset) => {
    try {
      const marker = "/storage/v1/object/public/marketing/";
      const url = record.url_archivo || "";
      const rawPath = url.includes(marker) ? url.split(marker)[1] : undefined;
      const path = rawPath ? decodeURIComponent(rawPath) : "";

      if (!path) {
        message.error("No se pudo identificar el archivo en Storage");
        return;
      }

      const { error: storageError } = await supabaseBrowserClient.storage
        .from("marketing")
        .remove([path]);

      if (storageError) {
        console.error("Error eliminando archivo en Storage:", storageError);
        message.error("No se pudo eliminar el archivo en Storage");
        return;
      }

      const { error } = await supabaseBrowserClient
        .from("marketing_assets")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      message.success("Asset eliminado de la base de datos y Storage");
      cargarAssets();
    } catch (error: any) {
      console.error("Error eliminando asset:", error);
      message.error("No se pudo eliminar el asset");
    }
  };

  const handleToggleVisibilidadIA = async (record: MarketingAsset) => {
    try {
      const { error } = await supabaseBrowserClient
        .from("marketing_assets")
        .update({ visible_para_ia: !record.visible_para_ia })
        .eq("id", record.id);

      if (error) throw error;
      message.success(
        record.visible_para_ia ? "Ocultado para la IA" : "Visible para la IA"
      );
      cargarAssets();
    } catch (error: any) {
      console.error("Error actualizando visibilidad:", error);
      message.error("No se pudo actualizar");
    }
  };

  const uploadProps: UploadProps = {
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error("El archivo debe ser menor a 10MB");
        return Upload.LIST_IGNORE;
      }
      setFileList([file as any]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  const stats = {
    total: assets.length,
    activos: assets.filter((a) => a.estado === "activo").length,
    visiblesIA: assets.filter((a) => a.visible_para_ia).length,
    flyers: assets.filter((a) => a.tipo_asset === "flyer").length,
  };

  const cargarMarketingCursos = async () => {
    try {
      setLoadingCursosMarketing(true);
      const { data, error } = await supabaseBrowserClient
        .from("marketing_centro")
        .select("id, titulo, tipo, estado, fecha_inicio, keywords")
        .order("fecha_inicio", { ascending: true });

      if (error) throw error;
      const items = (data as MarketingCurso[]) || [];
      setCursosMarketing(items);
      const draft: Record<number, string> = {};
      items.forEach((c) => {
        draft[c.id] = c.keywords?.join(", ") ?? "";
      });
      setKeywordsDraft(draft);
    } catch (error) {
      console.error("Error cargando marketing_centro:", error);
      message.error("No se pudieron cargar los cursos del Centro de Marketing");
    } finally {
      setLoadingCursosMarketing(false);
    }
  };

  const cargarAgentPrompt = async () => {
    try {
      setLoadingAgentPrompt(true);
      const { data, error } = await supabaseBrowserClient
        .from("agent_settings")
        .select("system_prompt, persona_name, persona_bio, speaking_style, greeting, fallback_response")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;
      agentForm.setFieldsValue({
        system_prompt: data?.system_prompt || DEFAULT_AGENT_SYSTEM_PROMPT,
        persona_name: data?.persona_name || "Dany",
        persona_bio: data?.persona_bio || "",
        speaking_style: data?.speaking_style || "",
        greeting: data?.greeting || "",
        fallback_response: data?.fallback_response || "",
      });
    } catch (error: any) {
      console.error("Error cargando prompt del agente:", error);
      message.error("No se pudo cargar el prompt del agente");
    } finally {
      setLoadingAgentPrompt(false);
    }
  };

  const guardarAgentPrompt = async () => {
    try {
      setSavingAgentPrompt(true);
      const values = agentForm.getFieldsValue();
      const payload = {
        id: 1,
        system_prompt: values.system_prompt || "",
        persona_name: values.persona_name || "Dany",
        persona_bio: values.persona_bio || null,
        speaking_style: values.speaking_style || null,
        greeting: values.greeting || null,
        fallback_response: values.fallback_response || null,
      };
      const { error } = await supabaseBrowserClient
        .from("agent_settings")
        .upsert(payload)
        .eq("id", 1);

      if (error) throw error;
      message.success("Prompt del agente guardado");
    } catch (error: any) {
      console.error("Error guardando prompt del agente:", error);
      message.error(error.message || "No se pudo guardar el prompt");
    } finally {
      setSavingAgentPrompt(false);
    }
  };

  const cargarDocs = async () => {
    try {
      setLoadingDocs(true);
      const { data, error } = await supabaseBrowserClient
        .from("agent_documents")
        .select("id, title, source_url, summary, keywords, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setDocs(data || []);
    } catch (error: any) {
      console.error("Error cargando docs agente:", error);
      message.error("No se pudieron cargar los documentos del agente");
    } finally {
      setLoadingDocs(false);
    }
  };

  const crearDocAgente = async (values: any) => {
    try {
      setIngestLoading(true);
      let urlArchivo = values.source_url as string | undefined;

      // Si hay archivo, súbelo al bucket agent-knowledge
      const files = values.file as UploadFile[] | undefined;
      if (files && files.length > 0) {
        const fileItem = files[0] as any;
        const file = (fileItem instanceof File) ? fileItem : (fileItem?.originFileObj as File | undefined);
        if (!file) throw new Error("No se pudo leer el archivo");

        const ext = file.name.split(".").pop() || "bin";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabaseBrowserClient.storage
          .from("agent-knowledge")
          .upload(fileName, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabaseBrowserClient.storage.from("agent-knowledge").getPublicUrl(uploadData.path);
        urlArchivo = publicData.publicUrl;
      }

      const res = await fetch("/api/ai/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          url: urlArchivo || values.source_url,
          raw_text: values.raw_text,
          mime_type: fileList[0]?.type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo procesar");
      message.success("Documento indexado para el agente");
      ingestForm.resetFields();
      setFileList([]);
      await cargarDocs();
    } catch (error: any) {
      console.error("Ingest error:", error);
      message.error(error.message || "Error al indexar documento");
    } finally {
      setIngestLoading(false);
    }
  };

  const eliminarDocAgente = async (id: number) => {
    try {
      setDeletingDocId(id);
      const { error } = await supabaseBrowserClient.from("agent_documents").delete().eq("id", id);
      if (error) throw error;
      message.success("Documento eliminado");
      await cargarDocs();
    } catch (error: any) {
      console.error("Delete doc error:", error);
      message.error(error.message || "No se pudo eliminar");
    } finally {
      setDeletingDocId(null);
    }
  };

  const guardarKeywordsCurso = async (id: number) => {
    const raw = keywordsDraft[id] ?? "";
    const keywords = raw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      setSavingCursoId(id);
      const { error } = await supabaseBrowserClient
        .from("marketing_centro")
        .update({ keywords })
        .eq("id", id);

      if (error) throw error;
      message.success("Keywords actualizadas");
      await cargarMarketingCursos();
    } catch (error: any) {
      console.error("Error guardando keywords:", error);
      message.error(error.message || "No se pudieron guardar las keywords");
    } finally {
      setSavingCursoId(null);
    }
  };

  const abrirAsistenteIA = (curso: MarketingCurso) => {
    setIaTargetCurso(curso);
    setIaResult({});
    setIaError(null);
    iaForm.setFieldsValue({
      titulo: curso.titulo,
      tipo: curso.tipo || "",
      estado: curso.estado || "",
      fecha_inicio: curso.fecha_inicio ? dayjs(curso.fecha_inicio).format("YYYY-MM-DD") : "",
      beneficios: "",
      publico: "",
      tono: "Cercano, claro y vendedor sin sonar robot",
      oferta: "",
    });
    setIaModalVisible(true);
  };

  const generarTextoIA = async (values: any) => {
    setIaLoading(true);
    setIaResult({});
    setIaError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, modo: "curso" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo generar con IA");

      setIaResult({ promo: data.promo_text, keywords: data.keywords });
      message.success("Texto generado con IA");
      if (iaTargetCurso?.id && data.keywords?.length) {
        setKeywordsDraft((prev) => ({ ...prev, [iaTargetCurso.id]: data.keywords.join(", ") }));
      }
    } catch (error: any) {
      console.error("Error IA:", error);
      const msg = error?.message || "Error generando con IA";
      setIaError(msg);
      message.error(msg);
    } finally {
      setIaLoading(false);
    }
  };

  const usarKeywordsIA = () => {
    if (!iaTargetCurso?.id || !iaResult.keywords?.length) return;
    setKeywordsDraft((prev) => ({ ...prev, [iaTargetCurso.id]: iaResult.keywords!.join(", ") }));
    message.success("Keywords aplicadas al curso");
  };

  const filteredAssets = assets.filter((a) => {
    const matchesSearch = searchTerm
      ? [a.titulo, a.descripcion, a.descripcion_ia, a.nombre_archivo, (a.keywords || []).join(" ")]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    const matchesTipo = filterTipo ? a.tipo_asset === filterTipo : true;
    const matchesCategoria = filterCategoria ? a.categoria === filterCategoria : true;
    const matchesIA = soloIA ? a.visible_para_ia : true;
    return matchesSearch && matchesTipo && matchesCategoria && matchesIA;
  });

  const formatoHorario = (curso: CursoProximo) => {
    const diasLista = Array.isArray(curso.dias_semana)
      ? curso.dias_semana
      : typeof curso.dias_semana === "string" && curso.dias_semana
        ? [curso.dias_semana]
        : [];

    const dias = diasLista.length > 0 ? diasLista.join(", ") : "Horario por confirmar";
    const hora = curso.hora_inicio && curso.hora_fin ? `${curso.hora_inicio} - ${curso.hora_fin}` : "Hora por confirmar";
    return `${dias} | ${hora}`;
  };

  const contextoIA = () => {
    const programasText = programas.length
      ? programas.map((p) => `- Programa: ${p.nombre}`).join("\n")
      : "(Sin programas cargados)";

    const cursosText = cursosProximos.length
      ? cursosProximos
          .map((c) => {
            const inicio = c.fecha_inicio ? dayjs(c.fecha_inicio).format("DD/MM") : "Fecha por confirmar";
            const programaNombre = Array.isArray(c.programas) && c.programas[0]?.nombre
              ? ` | Programa: ${c.programas[0].nombre}`
              : "";
            const cupos = c.cupos ? ` | Cupos: ${c.cupos}` : "";
            return `- ${c.nombre}${programaNombre} | Inicio: ${inicio} | ${formatoHorario(c)}${cupos}`;
          })
          .join("\n")
      : "(Sin cursos próximos)";

    return [
      "Contexto para IA: Programas y Cursos",
      "Programas activos:",
      programasText,
      "Próximos cursos:",
      cursosText,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const contextoAssetsIA = () => {
    const iaAssets = filteredAssets.filter((a) => a.visible_para_ia);
    if (!iaAssets.length) return "(Sin materiales visibles para la IA)";
    return iaAssets
      .slice(0, 25)
      .map((a) => {
        const pesoMb = a.tamano_bytes ? `${(a.tamano_bytes / (1024 * 1024)).toFixed(1)}MB` : "";
        const kws = a.keywords && a.keywords.length ? ` | keywords: ${a.keywords.join(", ")}` : "";
        return `- ${a.titulo} [${a.tipo_asset}] ${a.descripcion_ia || a.descripcion || ""} | url: ${a.url_archivo || "N/A"} ${pesoMb}${kws}`;
      })
      .join("\n");
  };

  const columns = [
    {
      title: "Archivo",
      dataIndex: "titulo",
      key: "titulo",
      render: (_: any, record: MarketingAsset) => (
        <Space>
          {record.tipo_asset === "imagen" || record.tipo_asset === "flyer" ? (
            <FileImageOutlined style={{ fontSize: 20, color: "#1890ff" }} />
          ) : record.tipo_asset === "pdf" ? (
            <FilePdfOutlined style={{ fontSize: 20, color: "#ff4d4f" }} />
          ) : (
            <FileOutlined style={{ fontSize: 20 }} />
          )}
          <div>
            <Text strong>{record.titulo}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.nombre_archivo}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Descripción IA",
      dataIndex: "descripcion_ia",
      key: "descripcion_ia",
      ellipsis: true,
      width: 300,
      render: (text: string) => (
        <Tooltip title={text}>
          <Text ellipsis>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: "Tipo",
      dataIndex: "tipo_asset",
      key: "tipo_asset",
      render: (tipo: string) => <Tag>{tipo}</Tag>,
    },
    {
      title: "Keywords",
      dataIndex: "keywords",
      key: "keywords",
      width: 200,
      render: (kws?: string[]) =>
        kws && kws.length ? (
          <Space wrap>
            {kws.map((k) => (
              <Tag key={k}>{k}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "IA",
      dataIndex: "visible_para_ia",
      key: "visible_para_ia",
      align: "center" as const,
      render: (visible: boolean, record: MarketingAsset) => (
        <Switch
          checked={visible}
          checkedChildren={<RobotOutlined />}
          unCheckedChildren="Off"
          onChange={() => handleToggleVisibilidadIA(record)}
        />
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado: string) => <Tag color={estadoColors[estado]}>{estado}</Tag>,
    },
    {
      title: "Fecha",
      dataIndex: "created_at",
      key: "created_at",
      render: (fecha: string) => dayjs(fecha).format("DD/MM/YY"),
    },
    {
      title: "Acciones",
      key: "acciones",
      render: (_: any, record: MarketingAsset) => (
        <Space>
          <Tooltip title="Ver archivo">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => {
                setPreviewUrl(record.url_archivo);
                setPreviewVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar este asset?"
            onConfirm={() => handleDelete(record)}
            okText="Sí"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const columnsCursosMarketing = [
    {
      title: "Título",
      dataIndex: "titulo",
      key: "titulo",
      render: (text: string, record: MarketingCurso) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          {record.tipo && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.tipo}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Estado",
      dataIndex: "estado",
      key: "estado",
      render: (estado?: string) => <Tag color={estadoColors[estado ?? ""] || "blue"}>{estado || "-"}</Tag>,
    },
    {
      title: "Inicio",
      dataIndex: "fecha_inicio",
      key: "fecha_inicio",
      render: (fecha?: string | null) => (fecha ? dayjs(fecha).format("DD/MM/YYYY") : "Fecha por definir"),
    },
    {
      title: "Keywords (IA)",
      key: "keywords",
      width: 320,
      render: (_: any, record: MarketingCurso) => (
        <Space align="start" wrap>
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ minWidth: 200 }}
            value={keywordsDraft[record.id] ?? ""}
            placeholder="uñas, manicure, gel"
            onChange={(e) => setKeywordsDraft((prev) => ({ ...prev, [record.id]: e.target.value }))}
          />
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            loading={savingCursoId === record.id}
            onClick={() => guardarKeywordsCurso(record.id)}
          >
            Guardar
          </Button>
        </Space>
      ),
    },
    {
      title: "IA",
      key: "ia",
      width: 90,
      render: (_: any, record: MarketingCurso) => (
        <Button
          size="small"
          icon={<RobotOutlined />}
          onClick={() => abrirAsistenteIA(record)}
        >
          IA
        </Button>
      ),
    },
  ];

  return (
    <Space
      direction="vertical"
      size="large"
      style={{ width: "100%", padding: isMobile ? "16px" : "24px" }}
    >
      {/* Header */}
      <Card
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          border: "none",
        }}
        bodyStyle={{ padding: isMobile ? "16px" : "24px" }}
      >
        <Space direction="vertical" size="small">
          <Space align="center" wrap>
            <RobotOutlined style={{ fontSize: 32, color: "#fff" }} />
            <Title level={2} style={{ margin: 0, color: "#fff" }}>
              Marketing Center
            </Title>
          </Space>
          <Text style={{ color: "#e6e6fa", fontSize: 16 }}>
            Material publicitario para el Agente de IA (Dany)
          </Text>
        </Space>
      </Card>

      {/* Estadísticas */}
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Total Assets" value={stats.total} prefix={<FileOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Activos"
              value={stats.activos}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Visibles para IA"
              value={stats.visiblesIA}
              prefix={<RobotOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Flyers" value={stats.flyers} prefix={<FileImageOutlined />} />
          </Card>
        </Col>
      </Row>

      <Skeleton active loading={initialLoading} paragraph={{ rows: isMobile ? 6 : 9 }}>
      <Tabs
        activeKey={activeTabKey}
        onChange={handleTabChange}
        destroyInactiveTabPane
        items={[
          {
            key: "agent",
            label: "Agente IA",
            children: (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                {/* Configuración del agente */}
                <Card
                  title="Agente IA: perfil y prompt"
                  bodyStyle={{ padding: isMobile ? "12px" : "16px" }}
                  extra={
                    <Space>
                      <Button type="primary" icon={<SaveOutlined />} loading={savingAgentPrompt} onClick={() => agentForm.submit()}>
                        Guardar
                      </Button>
                      <Button icon={<ReloadOutlined />} disabled={savingAgentPrompt} onClick={cargarAgentPrompt}>
                        Recargar
                      </Button>
                      <Dropdown
                        trigger={["click"]}
                        menu={{
                          items: [
                            {
                              key: "restore-default-prompt",
                              label: "Restaurar prompt por defecto",
                            },
                          ],
                          onClick: ({ key }) => {
                            if (key === "restore-default-prompt") {
                              restaurarPromptPorDefecto();
                            }
                          },
                        }}
                      >
                        <Button icon={<MoreOutlined />} disabled={savingAgentPrompt || loadingAgentPrompt} />
                      </Dropdown>
                    </Space>
                  }
                >
                  <Form layout="vertical" form={agentForm} onFinish={guardarAgentPrompt}>
                    <Text type="secondary">
                      Ajusta la identidad y el mensaje de sistema del agente. Esto se guarda en Supabase (tabla agent_settings) para que responda con el tono correcto.
                    </Text>

                    <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
                      <Col xs={24} md={12}>
                        <Form.Item name="persona_name" label="Nombre del agente" initialValue="Dany">
                          <Input placeholder="Dany" disabled={loadingAgentPrompt} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="speaking_style" label="Estilo / tono">
                          <Input
                            placeholder="Cálido, preciso, no inventa datos, CTA breve"
                            disabled={loadingAgentPrompt}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item name="persona_bio" label="Bio / personalidad" tooltip="Contexto breve sobre quién es y cómo ayuda">
                      <TextArea
                        rows={3}
                        placeholder="Asistente de la Academia Crystal, experto en cursos, pagos y WhatsApp corporativo. Transparente, amable y directo."
                        disabled={loadingAgentPrompt}
                      />
                    </Form.Item>

                    <Row gutter={[12, 12]}>
                      <Col xs={24} md={12}>
                        <Form.Item name="greeting" label="Saludo inicial">
                          <Input placeholder="¡Hola! Soy Dany, ¿en qué te ayudo hoy?" disabled={loadingAgentPrompt} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="fallback_response" label="Respuesta cuando falte info">
                          <Input placeholder="Déjame confirmarlo y te respondo en breve. No quiero inventar datos." disabled={loadingAgentPrompt} />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item label="Prompt de sistema" required>
                      <Space direction="vertical" size={8} style={{ width: "100%" }}>
                        <Space wrap>
                          <Button size="small" onClick={() => applyWhatsappFormatToPrompt("*")} disabled={loadingAgentPrompt}>Negrita</Button>
                          <Button size="small" onClick={() => applyWhatsappFormatToPrompt("_")} disabled={loadingAgentPrompt}>Cursiva</Button>
                          <Button size="small" onClick={() => applyWhatsappFormatToPrompt("~")} disabled={loadingAgentPrompt}>Tachado</Button>
                          <Button size="small" onClick={() => applyWhatsappFormatToPrompt("`")} disabled={loadingAgentPrompt}>Monoespacio</Button>
                          <Button size="small" onClick={() => applyWhatsappFormatToPrompt("```\n", "\n```", "código")}
                            disabled={loadingAgentPrompt}
                          >
                            Bloque código
                          </Button>
                          <Button size="small" onClick={() => insertIntoPrompt("\n• ")} disabled={loadingAgentPrompt}>Viñeta</Button>
                          <Button size="small" onClick={() => insertIntoPrompt("\n\n")} disabled={loadingAgentPrompt}>Párrafo</Button>
                          <Button size="small" onClick={() => insertIntoPrompt("✨")} disabled={loadingAgentPrompt}>✨</Button>
                          <Button size="small" onClick={() => insertIntoPrompt("📌")} disabled={loadingAgentPrompt}>📌</Button>
                          <Button size="small" onClick={() => insertIntoPrompt("✅")} disabled={loadingAgentPrompt}>✅</Button>
                        </Space>
                        <Text type="secondary">Atajos WhatsApp: *negrita*  _cursiva_  ~tachado~  `monoespacio`</Text>
                        <Form.Item
                          name="system_prompt"
                          noStyle
                          rules={[
                            { required: true, whitespace: true, message: "Define un prompt" },
                          ]}
                        >
                          <TextArea
                            id="agent-system-prompt"
                            rows={7}
                            placeholder="Eres Dany, asistente de la academia..."
                            disabled={loadingAgentPrompt}
                          />
                        </Form.Item>
                      </Space>
                    </Form.Item>

                    <Space wrap>
                      <Button type="primary" htmlType="submit" loading={savingAgentPrompt}>
                        Guardar configuración
                      </Button>
                      <Button onClick={cargarAgentPrompt} icon={<ReloadOutlined />} disabled={savingAgentPrompt}>
                        Recargar
                      </Button>
                    </Space>
                  </Form>
                </Card>

                {/* Conocimiento del agente: PDFs/texto */}
                <Card
                  title="Conocimiento del agente (PDF/texto)"
                  bodyStyle={{ padding: isMobile ? "12px" : "16px" }}
                  extra={<Button icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"} onClick={cargarDocs}>Recargar</Button>}
                >
                  <Space direction="vertical" style={{ width: "100%" }} size="middle">
                    <Text type="secondary">Sube un PDF o pega texto. Se indexa y se resume para que el agente lo use.</Text>
                    <Form layout="vertical" form={ingestForm} onFinish={crearDocAgente}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={12}>
                          <Form.Item name="title" label="Título" rules={[{ required: true, message: "Ingresa un título" }] }>
                            <Input placeholder="Manual de WhatsApp" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="source_url" label="URL pública (opcional)">
                            <Input placeholder="https://..." />
                          </Form.Item>
                        </Col>
                      </Row>
                      <Form.Item name="file" label="PDF/DOCX (opcional)">
                        <Upload
                          maxCount={1}
                          beforeUpload={(file) => {
                            setFileList([file as any]);
                            return false;
                          }}
                          fileList={fileList}
                          onRemove={() => setFileList([])}
                        >
                          <Button icon={<UploadOutlined />} block={isMobile}>Seleccionar PDF/DOCX</Button>
                        </Upload>
                      </Form.Item>
                      <Form.Item name="raw_text" label="Texto plano (opcional)">
                        <TextArea rows={3} placeholder="Pega aquí texto si no hay PDF" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={ingestLoading}>Indexar para el agente</Button>
                    </Form>

                    <Table
                      size={isMobile ? "small" : "middle"}
                      dataSource={docs}
                      loading={loadingDocs}
                      rowKey="id"
                      pagination={{ pageSize: isMobile ? 5 : 8 }}
                      columns={[
                        {
                          title: "Título",
                          dataIndex: "title",
                          key: "title",
                        },
                        {
                          title: "Resumen",
                          dataIndex: "summary",
                          key: "summary",
                          render: (text: string) => <Text ellipsis style={{ maxWidth: 360 }}>{text || "(sin resumen)"}</Text>,
                        },
                        {
                          title: "Keywords",
                          dataIndex: "keywords",
                          key: "keywords",
                          render: (kws?: string[]) => kws?.length ? <Space wrap>{kws.map((k) => <Tag key={k}>{k}</Tag>)}</Space> : <Text type="secondary">—</Text>,
                        },
                        {
                          title: "Fuente",
                          dataIndex: "source_url",
                          key: "source_url",
                          render: (url: string) => url ? <a href={url} target="_blank" rel="noreferrer">Ver</a> : <Text type="secondary">—</Text>,
                        },
                        {
                          title: "Fecha",
                          dataIndex: "created_at",
                          key: "created_at",
                          render: (f: string) => dayjs(f).format("DD/MM/YY"),
                        },
                        {
                          title: "Acciones",
                          key: "acciones",
                          render: (_: any, record: any) => (
                            <Popconfirm
                              title="¿Eliminar este documento?"
                              onConfirm={() => eliminarDocAgente(record.id)}
                              okText="Sí"
                              cancelText="No"
                            >
                              <Button
                                size={isMobile ? "small" : "middle"}
                                danger
                                loading={deletingDocId === record.id}
                              >
                                Eliminar
                              </Button>
                            </Popconfirm>
                          ),
                        },
                      ]}
                    />
                  </Space>
                </Card>

                {/* Contexto IA: Programas, Cursos y Materiales (oculto por defecto) */}
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button
                    type="default"
                    onClick={handleToggleContextoIA}
                    size={isMobile ? "small" : "middle"}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {mostrarContextoIA ? "Ocultar contexto IA" : "Mostrar contexto IA"}
                  </Button>

                  {mostrarContextoIA && (
                    <Card
                      title="Contexto IA: Programas, cursos próximos y materiales"
                      bodyStyle={{ padding: isMobile ? "16px" : "20px", background: "#f7f9fc" }}
                      extra={
                        <Space wrap>
                          <Button icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"} onClick={cargarProgramas}>
                            Recargar programas
                          </Button>
                          <Button icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"} onClick={cargarCursosProximos}>
                            Recargar cursos
                          </Button>
                          <Button icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"} onClick={cargarAssets}>
                            Recargar materiales
                          </Button>
                        </Space>
                      }
                    >
                      <Space direction="vertical" size="small" style={{ width: "100%" }}>
                        <Alert
                          type="info"
                          showIcon
                          message="Guía rápida"
                          description="Recarga, revisa y copia el contexto para que el agente IA responda con datos actuales (programas, cursos, materiales)."
                        />

                        <Divider style={{ margin: "12px 0" }} plain>
                          Programas y cursos
                        </Divider>
                        <Text
                          code
                          style={{ whiteSpace: "pre-wrap", width: "100%", display: "block", padding: "8px", background: "#fff" }}
                        >
                          {contextoIA()}
                        </Text>

                        <Divider style={{ margin: "12px 0" }} plain>
                          Materiales visibles para IA
                        </Divider>
                        <Text
                          code
                          style={{ whiteSpace: "pre-wrap", width: "100%", display: "block", padding: "8px", background: "#fff" }}
                        >
                          {contextoAssetsIA()}
                        </Text>

                        <Space wrap>
                          <Button onClick={() => navigator.clipboard.writeText(contextoIA())} size={isMobile ? "small" : "middle"}>
                            Copiar contexto IA
                          </Button>
                          <Button onClick={() => navigator.clipboard.writeText(contextoAssetsIA())} size={isMobile ? "small" : "middle"}>
                            Copiar materiales IA
                          </Button>
                          <Button onClick={cargarDatos} icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"}>
                            Refrescar todo
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  )}
                </Space>

                {/* Cursos/Grupos (marketing_centro) */}
                <Card
                  title="Cursos y grupos (Centro de Marketing)"
                  extra={
                    <Space wrap>
                      <Button icon={<ReloadOutlined />} size={isMobile ? "small" : "middle"} onClick={cargarMarketingCursos}>
                        Recargar cursos
                      </Button>
                    </Space>
                  }
                  bodyStyle={{ padding: isMobile ? "12px" : "20px" }}
                >
                  <Table
                    columns={columnsCursosMarketing}
                    dataSource={cursosMarketing}
                    rowKey="id"
                    loading={loadingCursosMarketing}
                    size={isMobile ? "small" : "middle"}
                    pagination={{ pageSize: isMobile ? 5 : 8 }}
                    scroll={{ x: 720 }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: "assets",
            label: "Materiales",
            children: (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Card
                  title="Assets de Marketing"
                  extra={
                    <Space wrap>
                      <Input.Search
                        placeholder="Buscar título, descripción, keywords"
                        allowClear
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? 220 : 260 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Select
                        allowClear
                        placeholder="Tipo"
                        options={tipoAssetOptions}
                        onChange={(v) => setFilterTipo(v as string | undefined)}
                        style={{ width: 120 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Select
                        allowClear
                        placeholder="Categoría"
                        options={categoriaOptions.map((c) => ({ value: c, label: c }))}
                        onChange={(v) => setFilterCategoria(v as string | undefined)}
                        style={{ width: 140 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Switch
                        checked={soloIA}
                        onChange={(v) => setSoloIA(v)}
                        checkedChildren="Solo IA"
                        unCheckedChildren="Todos"
                        size={isMobile ? "small" : "default"}
                      />
                      <Button icon={<ReloadOutlined />} onClick={cargarAssets} size={isMobile ? "small" : "middle"}>
                        Recargar
                      </Button>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        size={isMobile ? "small" : "middle"}
                        onClick={() => {
                          setEditingAsset(null);
                          form.resetFields();
                          setFileList([]);
                          setModalVisible(true);
                        }}
                      >
                        Nuevo Asset
                      </Button>
                    </Space>
                  }
                >
                  <Table
                    columns={columns}
                    dataSource={filteredAssets}
                    rowKey="id"
                    loading={loading}
                    size={isMobile ? "small" : "middle"}
                    scroll={{ x: 960 }}
                    pagination={{ pageSize: isMobile ? 5 : 10 }}
                  />
                </Card>
              </Space>
            ),
          },
        ]}
      />
      </Skeleton>

      {/* Modal IA para generar copy y keywords */}
      <Modal
        title="Asistente IA: texto y keywords"
        open={iaModalVisible}
        onCancel={() => {
          setIaModalVisible(false);
          setIaResult({});
          iaForm.resetFields();
          setIaTargetCurso(null);
        }}
        onOk={() => iaForm.submit()}
        okText="Generar con IA"
        confirmLoading={iaLoading}
        width={isMobile ? 360 : 720}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="Describe el curso y la IA sugerirá un texto promocional y keywords para el bot."
          />
          {iaError && (
            <Alert type="error" showIcon message={iaError} />
          )}

          <Form form={iaForm} layout="vertical" onFinish={generarTextoIA}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={14}>
                <Form.Item name="titulo" label="Título del curso" rules={[{ required: true, message: "Ingresa un título" }] }>
                  <Input placeholder="Ej: Miradas Perfectas" />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <Form.Item name="tipo" label="Tipo" tooltip="Diplomado, taller, grupo, etc.">
                  <Input placeholder="Taller" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Form.Item name="fecha_inicio" label="Fecha de inicio (opcional)">
                  <Input placeholder="2026-02-20" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="oferta" label="Precio u oferta (opcional)">
                  <Input placeholder="$350.000 promo lanzamiento" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="beneficios" label="Beneficios o diferenciales" rules={[{ required: true, message: "Añade beneficios" }] }>
              <TextArea rows={3} placeholder="Ej: incluye kit inicial, certificación, práctica en modelo real" />
            </Form.Item>

            <Form.Item name="publico" label="Público objetivo" tooltip="A quién va dirigido">
              <Input placeholder="Principiantes en belleza, estilistas que quieren actualizarse" />
            </Form.Item>

            <Form.Item name="tono" label="Tono" initialValue="Cercano, claro y vendedor sin exagerar">
              <Input placeholder="Cercano, claro y vendedor sin exagerar" />
            </Form.Item>
          </Form>

          {iaResult.promo && (
            <Card size="small" title="Texto promocional sugerido">
              <TextArea value={iaResult.promo} readOnly autoSize={{ minRows: 3, maxRows: 6 }} />
              <Space style={{ marginTop: 8 }}>
                <Button onClick={() => navigator.clipboard.writeText(iaResult.promo || "")}>Copiar texto</Button>
              </Space>
            </Card>
          )}

          {iaResult.keywords && iaResult.keywords.length > 0 && (
            <Card size="small" title="Keywords sugeridas">
              <Space wrap>
                {iaResult.keywords.map((k) => (
                  <Tag key={k}>{k}</Tag>
                ))}
              </Space>
              {iaTargetCurso && (
                <Button style={{ marginTop: 8 }} type="primary" onClick={usarKeywordsIA}>
                  Usar en este curso
                </Button>
              )}
            </Card>
          )}
        </Space>
      </Modal>

      {/* Modal de Crear/Editar */}
      <Modal
        title={editingAsset ? "Editar Asset" : "Nuevo Asset de Marketing"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
          setFileList([]);
          setEditingAsset(null);
        }}
        onOk={() => form.submit()}
        okText={editingAsset ? "Actualizar" : "Crear"}
        cancelText="Cancelar"
        width={isMobile ? 360 : 700}
        confirmLoading={uploading}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            name="titulo"
            label="Título"
            rules={[{ required: true, message: "Ingresa un título" }]}
          >
            <Input placeholder="Ej: Flyer Promoción Manicure Febrero 2026" />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción (opcional)">
            <TextArea rows={2} placeholder="Descripción general del material" />
          </Form.Item>

          <Form.Item
            name="descripcion_ia"
            label="Descripción para la IA (Crucial)"
            rules={[
              {
                required: true,
                message: "Describe el contenido para que la IA lo entienda",
              },
            ]}
            tooltip="La IA usará esto para saber cuándo compartir este material"
          >
            <TextArea
              rows={3}
              placeholder="Ej: Promoción de manicure con 20% descuento válida hasta fin de mes. Incluye imagen de diseño de uñas francesas y precio especial de $45.000"
            />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item
                name="tipo_asset"
                label="Tipo de archivo"
                rules={[{ required: true, message: "Selecciona el tipo" }]}
              >
                <Select placeholder="Selecciona tipo" options={tipoAssetOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoria" label="Categoría">
                <Select
                  placeholder="Selecciona categoría"
                  options={categoriaOptions.map((c) => ({ value: c, label: c }))}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="keywords" label="Keywords (separadas por coma)" tooltip="Para búsqueda">
            <Input placeholder="manicure, promoción, febrero, descuento" />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item name="programa_id" label="Programa relacionado">
                <Select
                  placeholder="Selecciona programa"
                  options={programas.map((p) => ({ value: p.id, label: p.nombre }))}
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="estado" label="Estado" initialValue="activo">
                <Select
                  options={[
                    { value: "activo", label: "Activo" },
                    { value: "inactivo", label: "Inactivo" },
                    { value: "archivado", label: "Archivado" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="visible_para_ia"
            label="Visible para la IA"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Sí" unCheckedChildren="No" />
          </Form.Item>

          <Form.Item label="Archivo" tooltip="Max 10MB">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} block={isMobile}>
                {editingAsset ? "Cambiar archivo (opcional)" : "Seleccionar archivo"}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Preview */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
      >
        {previewUrl.endsWith(".pdf") ? (
          <iframe src={previewUrl} width="100%" height="600px" style={{ border: "none" }} />
        ) : (
          <Image src={previewUrl} alt="Preview" style={{ width: "100%" }} />
        )}
      </Modal>
    </Space>
  );
}
