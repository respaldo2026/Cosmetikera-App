"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Table,
  Button,
  Space,
  Card,
  Tag,
  Tabs,
  App,
  Divider,
  message as antMessage,
  Upload,
  Select,
  Drawer,
  Empty,
  Progress,
  Tooltip,
  List,
  Alert,
  Radio,
  Dropdown,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileOutlined,
  GiftOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  EyeOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { logger } from "@utils/logger";
import type { UploadFile } from "antd";

const { Title, Text } = require("antd").Typography;

interface Pensum {
  id: string;
  programa_id: number;
  numero_ciclo: number;
  nombre_ciclo: string;
  descripcion: string;
  duracion_semanas: number;
  total_horas: number;
  orden: number;
  activo: boolean;
}

const normalizeHttpUrl = (value?: string | null): string => {
  const raw = String(value || "").trim().replace(/&amp;/gi, "&");
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
};

const hasMalformedEmbedTokens = (value?: string | null): boolean => {
  const raw = String(value || "");
  return /%_ENCODED_%|\{\"|\{"/i.test(raw);
};

const isAllowedEmbedHost = (value?: string | null): boolean => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return false;

  try {
    const host = new URL(normalized).hostname.toLowerCase();
    return host === "gamma.app" || host.endsWith(".gamma.app");
  } catch {
    return false;
  }
};

const extractIframeSrc = (value?: string | null): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const iframeMatch = raw.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  const candidate = iframeMatch?.[1] ? iframeMatch[1].trim() : raw;
  return normalizeHttpUrl(candidate);
};

const toGammaEmbedUrl = (value?: string | null): string => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!(host === "gamma.app" || host.endsWith(".gamma.app"))) {
      return normalized;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] === "embed") {
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }

    const documentId = segments[segments.length - 1];
    if (!documentId) return normalized;

    parsed.pathname = `/embed/${documentId}`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return normalized;
  }
};

const isHttpUrl = (value?: string | null): boolean => Boolean(normalizeHttpUrl(value));

interface PensumCurso {
  id: string;
  pensum_id?: string;
  nombre_curso: string;
  descripcion: string;
  horas: number;
  creditos: number;
  tipo_curso: string;
  orden: number;
}

interface MaterialDidactico {
  id: string;
  titulo: string;
  descripcion: string;
  tipo_material: string;
  nombre_archivo: string;
  url_archivo: string;
  tamano_bytes: number;
  mime_type: string;
  subido_por_nombre: string;
  created_at: string;
  pensum_id?: string;
  nombre_ciclo?: string | null;
  programa_nombre?: string | null;
}

interface MaterialClase {
  id: string;
  programa_id: number;
  pensum_id?: string | null;
  pensum_curso_id: string;
  material_ciclo_id?: string | null;
  nombre_material: string;
  cantidad?: string | null;
  unidad?: string | null;
  observaciones?: string | null;
  obligatorio: boolean;
  orden: number;
  activo: boolean;
  materiales_ciclo?: MaterialCiclo | null;
}

interface MaterialCiclo {
  id: string;
  programa_id: number;
  pensum_id: string;
  nombre: string;
  cantidad?: string | null;
  incluido_kit: boolean;
  orden: number;
  activo: boolean;
}

interface QuizClase {
  id: string;
  programa_id: number;
  pensum_id?: string | null;
  pensum_curso_id: string;
  titulo: string;
  descripcion?: string | null;
  total_preguntas: number;
  activo: boolean;
  publicado: boolean;
  created_at?: string;
  updated_at?: string;
}

interface GestorPensumProps {
  programaId: string;
  programaNombre: string;
  onClose: () => void;
}

export default function GestorPensum({
  programaId,
  programaNombre,
  onClose,
}: GestorPensumProps) {
  const { message, modal } = App.useApp();
  const [formCurso] = Form.useForm();
  const [formMaterial] = Form.useForm();
  const [formCiclo] = Form.useForm();
  const [formMaterialClase] = Form.useForm();
  const [formMaterialCiclo] = Form.useForm();
  const [formQuiz] = Form.useForm();

  // Estados para pensum
  const [pensums, setPensums] = useState<Pensum[]>([]);
  const [loadingPensums, setLoadingPensums] = useState(false);
  interface ProgramaData {
    id: number;
    nombre: string;
    duracion: string;
    total_clases?: number;
    horas_por_clase?: number;
    [key: string]: unknown;
  }
  const [programaData, setProgramaData] = useState<ProgramaData | null>(null);

  // Estados para cursos del pensum
  const [cursosPensum, setCursosPensum] = useState<PensumCurso[]>([]);
  const [cursosPrograma, setCursosPrograma] = useState<PensumCurso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [modalCursoVisible, setModalCursoVisible] = useState(false);
  const [editingCurso, setEditingCurso] = useState<PensumCurso | null>(null);

  // Estados para editar ciclo
  const [modalCicloVisible, setModalCicloVisible] = useState(false);
  const [editingCiclo, setEditingCiclo] = useState<Pensum | null>(null);

  // Estados para material didáctico
  const [materiales, setMateriales] = useState<MaterialDidactico[]>([]);
  const [loadingMateriales, setLoadingMateriales] = useState(false);
  const [materialesCicloGeneral, setMaterialesCicloGeneral] = useState<MaterialCiclo[]>([]);
  const [loadingMaterialesCiclo, setLoadingMaterialesCiclo] = useState(false);
  const [materialesClase, setMaterialesClase] = useState<MaterialClase[]>([]);
  const [loadingMaterialesClase, setLoadingMaterialesClase] = useState(false);
  const [drawerMaterialesVisible, setDrawerMaterialesVisible] = useState(false);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [editingMaterial, setEditingMaterial] = useState<MaterialDidactico | null>(null);
  const [modalMaterialClaseVisible, setModalMaterialClaseVisible] = useState(false);
  const [editingMaterialClase, setEditingMaterialClase] = useState<MaterialClase | null>(null);
  const [modalMaterialCicloVisible, setModalMaterialCicloVisible] = useState(false);
  const [editingMaterialCiclo, setEditingMaterialCiclo] = useState<MaterialCiclo | null>(null);
  const [quizzesClase, setQuizzesClase] = useState<QuizClase[]>([]);
  const [loadingQuizzesClase, setLoadingQuizzesClase] = useState(false);
  const [modalQuizVisible, setModalQuizVisible] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState<QuizClase | null>(null);
  const [cursoQuizActivo, setCursoQuizActivo] = useState<PensumCurso | null>(null);
  const [tipoOrigen, setTipoOrigen] = useState<'archivo' | 'enlace' | 'iframe'>('archivo');
  const [mostrarListaCompletaCiclo, setMostrarListaCompletaCiclo] = useState(false);
  const [mostrarListaCompletaNecesarios, setMostrarListaCompletaNecesarios] = useState(false);
  const [mostrarTablaMaestraClases, setMostrarTablaMaestraClases] = useState(false);
  const [iframePreview, setIframePreview] = useState<{ open: boolean; title: string; src: string }>({
    open: false,
    title: "",
    src: "",
  });

  // Estados para navegación
  const [selectedCicloId, setSelectedCicloId] = useState<string | null>(null);
  const [selectedCursoId, setSelectedCursoId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>("");

  const canManageMateriales = useMemo(() => {
    return ["admin", "director", "secretaria"].includes(currentRole.toLowerCase());
  }, [currentRole]);

  // Cargar información del programa
  const cargarPrograma = useCallback(async () => {
    try {
      const { data, error } = await supabaseBrowserClient
        .from("programas")
        .select("*")
        .eq("id", programaId)
        .single();

      if (error) throw error;
      setProgramaData(data);
    } catch (error) {
      message.error("Error al cargar programa");
      logger.error(error);
    }
  }, [programaId, message]);

  const cargarRolActual = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabaseBrowserClient.auth.getUser();

      if (!user?.id) {
        setCurrentRole("");
        return;
      }

      const { data, error } = await supabaseBrowserClient
        .from("perfiles")
        .select("rol, email")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      let rolDetectado = String(data?.rol || "").toLowerCase();

      if (!rolDetectado && user.email) {
        const { data: perfilPorEmail, error: errorEmail } = await supabaseBrowserClient
          .from("perfiles")
          .select("rol")
          .eq("email", user.email)
          .maybeSingle();

        if (!errorEmail && perfilPorEmail?.rol) {
          rolDetectado = String(perfilPorEmail.rol).toLowerCase();
        }
      }

      if (!rolDetectado) {
        const rolMeta = (user.user_metadata as any)?.rol || (user.app_metadata as any)?.rol;
        rolDetectado = String(rolMeta || "").toLowerCase();
      }

      setCurrentRole(rolDetectado);
    } catch (error) {
      logger.error("Error al cargar rol actual", error);
      setCurrentRole("");
    }
  }, []);

  const cargarPensums = useCallback(async () => {
    setLoadingPensums(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("pensum")
        .select("*")
        .eq("programa_id", programaId)
        .order("numero_ciclo", { ascending: true });

      if (error) throw error;
      setPensums(data || []);
    } catch (error) {
      message.error("Error al cargar pensum");
      logger.error(error);
    } finally {
      setLoadingPensums(false);
    }
  }, [programaId, message]);

  // Verificar y crear ciclos automáticamente según la duración del programa
  const verificarYCrearCiclos = useCallback(async () => {
    if (!programaData?.duracion) {
      await cargarPensums();
      return;
    }

    // Extraer número de ciclos/meses de la duración (ej: "4 meses" -> 4)
    const duracionStr = String(programaData.duracion);
    const numeroCiclos = parseInt(duracionStr.match(/\d+/)?.[0] || "0", 10);

    if (numeroCiclos === 0) {
      await cargarPensums();
      return;
    }

    // Verificar ciclos existentes
    const { data: ciclosExistentes, error } = await supabaseBrowserClient
      .from("pensum")
      .select("numero_ciclo")
      .eq("programa_id", programaId);

    if (error) {
      logger.error("Error verificando ciclos:", error);
      await cargarPensums();
      return;
    }

    const ciclosQueExisten = new Set(ciclosExistentes?.map(c => c.numero_ciclo) || []);
    const ciclosFaltantes = [];

    // Crear los ciclos que faltan
    for (let i = 1; i <= numeroCiclos; i++) {
      if (!ciclosQueExisten.has(i)) {
        ciclosFaltantes.push({
          programa_id: programaId,
          numero_ciclo: i,
          nombre_ciclo: `Ciclo ${i}`,
          descripcion: `Contenido académico del ciclo ${i}`,
          duracion_semanas: 4,
          total_horas: 0,
          orden: i,
          activo: true,
        });
      }
    }

    if (ciclosFaltantes.length > 0) {
      try {
        // Usar API route que tiene permisos de service_role para bypasear RLS
        const response = await fetch("/api/pensum/create-ciclos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programaId,
            ciclosFaltantes,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          logger.error("Error creando ciclos:", errorData);
          message.error("Error al crear ciclos automáticamente");
        }
      } catch (error) {
        logger.error("Error al llamar API crear ciclos:", error);
        message.error("Error de conexión al crear ciclos");
      }
    }

    await cargarPensums();
  }, [programaData, programaId, cargarPensums, message]);

  // ==================== PENSUM ====================

  const handleEditarCiclo = (e: React.MouseEvent, pensum: Pensum) => {
    e.stopPropagation();
    setEditingCiclo(pensum);
    formCiclo.setFieldsValue({
      nombre_ciclo: pensum.nombre_ciclo,
      descripcion: pensum.descripcion
    });
    setModalCicloVisible(true);
  };

  const handleGuardarCiclo = async () => {
    try {
      const values = await formCiclo.validateFields();
      if (!editingCiclo) return;

      // Actualización optimista: Actualizar el estado local inmediatamente para ver el cambio
      setPensums(prev => prev.map(p => 
        p.id === editingCiclo.id 
          ? { ...p, nombre_ciclo: values.nombre_ciclo, descripcion: values.descripcion }
          : p
      ));

      const { data, error } = await supabaseBrowserClient
        .from("pensum")
        .update({
          nombre_ciclo: values.nombre_ciclo,
          descripcion: values.descripcion,
        })
        .eq("id", editingCiclo.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("No se pudieron guardar los cambios. Verifica permisos.");
      }

      message.success("Ciclo actualizado");
      setModalCicloVisible(false);
      setEditingCiclo(null);
      cargarPensums();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "Error al actualizar ciclo");
      } else {
        message.error("Error al actualizar ciclo");
      }
      cargarPensums(); // Si falla, recargamos para revertir el cambio visual
    }
  };

  // ==================== CURSOS DEL PENSUM ====================

  const normalizarOrdenTemas = useCallback(async (pensumId: string, cursos: PensumCurso[]) => {
    if (!cursos.length) return cursos;

    const cursosOrdenados = [...cursos].sort((a, b) => {
      const ordenA = Number.isFinite(Number(a.orden)) ? Number(a.orden) : Number.MAX_SAFE_INTEGER;
      const ordenB = Number.isFinite(Number(b.orden)) ? Number(b.orden) : Number.MAX_SAFE_INTEGER;
      if (ordenA !== ordenB) return ordenA - ordenB;
      return String(a.nombre_curso || "").localeCompare(String(b.nombre_curso || ""), "es", { sensitivity: "base" });
    });

    const indiceBioseguridad = cursosOrdenados.findIndex((curso) =>
      String(curso.nombre_curso || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes("bioseguridad")
    );

    const cursosFinales = [...cursosOrdenados];
    if (indiceBioseguridad > 0) {
      const [cursoBio] = cursosFinales.splice(indiceBioseguridad, 1);
      if (cursoBio) cursosFinales.unshift(cursoBio);
    }

    const actualizaciones = cursosFinales
      .map((curso, index) => ({ id: curso.id, orden: index + 1 }))
      .filter((update) => {
        const original = cursos.find((c) => c.id === update.id);
        return Number(original?.orden || 0) !== update.orden;
      });

    if (actualizaciones.length > 0) {
      await Promise.all(
        actualizaciones.map((update) =>
          supabaseBrowserClient
            .from("pensum_cursos")
            .update({ orden: update.orden })
            .eq("id", update.id)
            .eq("pensum_id", pensumId)
        )
      );
    }

    return cursosFinales.map((curso, index) => ({ ...curso, orden: index + 1 }));
  }, []);

  const cargarCursosPensum = useCallback(async (pensumId: string) => {
    setLoadingCursos(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("pensum_cursos")
        .select("*")
        .eq("pensum_id", pensumId)
        .order("orden", { ascending: true });

      if (error) throw error;
      const cursosNormalizados = await normalizarOrdenTemas(pensumId, (data || []) as PensumCurso[]);
      setCursosPensum(cursosNormalizados || []);
    } catch (error) {
      message.error("Error al cargar cursos");
    } finally {
      setLoadingCursos(false);
    }
  }, [message, normalizarOrdenTemas]);

  const cargarCursosPrograma = useCallback(async (pensumsActuales?: Pensum[]) => {
    try {
      const sourcePensums = Array.isArray(pensumsActuales) ? pensumsActuales : pensums;
      const ids = (sourcePensums || []).map((p) => String(p.id)).filter(Boolean);

      if (ids.length === 0) {
        setCursosPrograma([]);
        return;
      }

      const { data, error } = await supabaseBrowserClient
        .from("pensum_cursos")
        .select("id, pensum_id, nombre_curso, descripcion, horas, creditos, tipo_curso, orden")
        .in("pensum_id", ids);

      if (error) throw error;

      const cicloOrderByPensum = new Map<string, number>();
      (sourcePensums || []).forEach((ciclo) => {
        const order = Number(ciclo?.orden || ciclo?.numero_ciclo || 9999);
        cicloOrderByPensum.set(String(ciclo.id), Number.isFinite(order) ? order : 9999);
      });

      const sorted = ((data || []) as PensumCurso[])
        .slice()
        .sort((a, b) => {
          const cicloA = cicloOrderByPensum.get(String(a?.pensum_id || "")) ?? 9999;
          const cicloB = cicloOrderByPensum.get(String(b?.pensum_id || "")) ?? 9999;
          if (cicloA !== cicloB) return cicloA - cicloB;
          const ordenA = Number(a?.orden || 9999);
          const ordenB = Number(b?.orden || 9999);
          if (ordenA !== ordenB) return ordenA - ordenB;
          return String(a?.nombre_curso || "").localeCompare(String(b?.nombre_curso || ""), "es", { sensitivity: "base" });
        });

      setCursosPrograma(sorted);
    } catch (error) {
      console.error(error);
      setCursosPrograma([]);
    }
  }, [pensums]);

  const sincronizarListaClasesPrograma = useCallback(async () => {
    const totalEsperado = Number(programaData?.total_clases || 0);
    if (!Number.isFinite(totalEsperado) || totalEsperado <= 0) {
      message.warning("Define 'Total de clases' en el programa antes de sincronizar la lista.");
      return;
    }

    const ciclosOrdenados = (pensums || [])
      .slice()
      .sort((a, b) => Number(a?.orden || a?.numero_ciclo || 9999) - Number(b?.orden || b?.numero_ciclo || 9999));

    if (ciclosOrdenados.length === 0) {
      message.warning("No hay ciclos en el pensum. Primero configura los ciclos del programa.");
      return;
    }

    const totalActual = cursosPrograma.length;
    if (totalActual >= totalEsperado) {
      message.info(`La lista ya tiene ${totalActual} clases. No se agregaron nuevas.`);
      return;
    }

    const porCiclo = new Map<string, PensumCurso[]>();
    (cursosPrograma || []).forEach((curso) => {
      const key = String(curso?.pensum_id || "");
      const current = porCiclo.get(key) || [];
      current.push(curso);
      porCiclo.set(key, current);
    });

    const maxOrdenPorCiclo = new Map<string, number>();
    ciclosOrdenados.forEach((ciclo) => {
      const key = String(ciclo.id);
      const maxOrden = Math.max(
        0,
        ...(porCiclo.get(key) || []).map((item) => Number(item?.orden || 0)).filter((n) => Number.isFinite(n))
      );
      maxOrdenPorCiclo.set(key, maxOrden);
    });

    const horasBase = Number(programaData?.horas_por_clase || 0);
    const inserts: Array<Record<string, any>> = [];
    const ciclosCount = ciclosOrdenados.length;

    for (let classNumber = totalActual + 1; classNumber <= totalEsperado; classNumber += 1) {
      const targetCiclo = ciclosOrdenados[(classNumber - 1) % ciclosCount] ?? ciclosOrdenados[0];
      if (!targetCiclo) {
        continue;
      }
      const cicloKey = String(targetCiclo.id);
      const ordenActual = (maxOrdenPorCiclo.get(cicloKey) || 0) + 1;
      maxOrdenPorCiclo.set(cicloKey, ordenActual);

      inserts.push({
        pensum_id: targetCiclo.id,
        nombre_curso: `Clase ${classNumber}`,
        descripcion: `Clase ${classNumber} del programa`,
        horas: Number.isFinite(horasBase) ? horasBase : 0,
        creditos: 0,
        tipo_curso: "obligatorio",
        orden: ordenActual,
      });
    }

    if (!inserts.length) return;

    const { error } = await supabaseBrowserClient.from("pensum_cursos").insert(inserts);
    if (error) {
      message.error(`No se pudo sincronizar la lista: ${error.message}`);
      return;
    }

    await cargarCursosPrograma(ciclosOrdenados);
    if (selectedCicloId) {
      await cargarCursosPensum(selectedCicloId);
    }

    message.success(`Lista sincronizada: ${totalEsperado} clases disponibles para el programa.`);
  }, [programaData, pensums, cursosPrograma, message, cargarCursosPrograma, selectedCicloId, cargarCursosPensum]);

  const handleGuardarCurso = async () => {
    try {
      const values = await formCurso.validateFields();
      if (!selectedCicloId) return;

      const payload = {
        ...values,
        pensum_id: selectedCicloId,
      };

      if (editingCurso) {
        const { error } = await supabaseBrowserClient
          .from("pensum_cursos")
          .update(payload)
          .eq("id", editingCurso.id);
        if (error) throw error;
        message.success("Curso actualizado");
      } else {
        const { error } = await supabaseBrowserClient
          .from("pensum_cursos")
          .insert([payload]);
        if (error) throw error;
        message.success("Curso agregado");
      }

      formCurso.resetFields();
      setEditingCurso(null);
      setModalCursoVisible(false);
      cargarCursosPensum(selectedCicloId);
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "Error");
      } else {
        message.error("Error");
      }
    }
  };

  const handleEliminarCurso = (cursoId: string) => {
    modal.confirm({
      title: "Eliminar tema",
      content: "¿Estás seguro?",
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("pensum_cursos")
            .delete()
            .eq("id", cursoId);
          if (error) throw error;
          message.success("Tema eliminado");
          if (selectedCicloId) cargarCursosPensum(selectedCicloId);
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message || "Error");
          } else {
            message.error("Error");
          }
        }
      },
    });
  };

  // ==================== MATERIAL DIDÁCTICO ====================

  const cargarMateriales = useCallback(async () => {
    setLoadingMateriales(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("v_material_completo")
        .select("*")
        .eq("programa_id", programaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMateriales(data || []);
    } catch (error) {
      message.error("Error al cargar materiales");
      console.error(error);
    } finally {
      setLoadingMateriales(false);
    }
  }, [programaId, message]);

  const cargarMaterialesCiclo = useCallback(async () => {
    setLoadingMaterialesCiclo(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("materiales_ciclo")
        .select("id, programa_id, pensum_id, nombre, cantidad, incluido_kit, orden, activo")
        .eq("programa_id", programaId)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMaterialesCicloGeneral(data || []);
    } catch (error) {
      message.error("Error al cargar materiales del ciclo");
      logger.error(error);
    } finally {
      setLoadingMaterialesCiclo(false);
    }
  }, [programaId, message]);

  const cargarMaterialesClase = useCallback(async () => {
    setLoadingMaterialesClase(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("materiales_clase")
        .select("id, programa_id, pensum_id, pensum_curso_id, material_ciclo_id, nombre_material, cantidad, unidad, observaciones, obligatorio, orden, activo, materiales_ciclo:material_ciclo_id (id, nombre, cantidad, incluido_kit)")
        .eq("programa_id", programaId)
        .eq("activo", true)
        .order("orden", { ascending: true });

      if (error) throw error;
      const normalizados = (data || []).map((item: any) => ({
        ...item,
        materiales_ciclo: Array.isArray(item.materiales_ciclo)
          ? item.materiales_ciclo[0] || null
          : item.materiales_ciclo || null,
      }));
      setMaterialesClase(normalizados as MaterialClase[]);
    } catch (error) {
      message.error("Error al cargar materiales por clase");
      logger.error(error);
    } finally {
      setLoadingMaterialesClase(false);
    }
  }, [programaId, message]);

  const cargarQuizzesClase = useCallback(async () => {
    setLoadingQuizzesClase(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("quizzes_clase")
        .select("id, programa_id, pensum_id, pensum_curso_id, titulo, descripcion, total_preguntas, activo, publicado, created_at, updated_at")
        .eq("programa_id", Number(programaId))
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzesClase((data || []) as QuizClase[]);
    } catch (error) {
      message.error("Error al cargar quizzes por clase");
      logger.error(error);
    } finally {
      setLoadingQuizzesClase(false);
    }
  }, [programaId, message]);

  const abrirModalQuiz = (curso: PensumCurso, quiz?: QuizClase | null) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar quizzes.");
      return;
    }

    setCursoQuizActivo(curso);
    setEditingQuiz(quiz || null);
    formQuiz.setFieldsValue({
      titulo: quiz?.titulo || `Quiz - ${curso.nombre_curso}`,
      descripcion: quiz?.descripcion || "",
      total_preguntas: quiz?.total_preguntas || 25,
      publicado: quiz?.publicado ?? false,
      activo: quiz?.activo ?? true,
    });
    setModalQuizVisible(true);
  };

  const handleGuardarQuiz = async () => {
    try {
      if (!canManageMateriales) {
        message.warning("Solo administración y secretaría pueden gestionar quizzes.");
        return;
      }

      if (!cursoQuizActivo) {
        message.error("Selecciona un tema para crear el quiz.");
        return;
      }

      const values = await formQuiz.validateFields();
      const payload = {
        programa_id: Number(programaId),
        pensum_id: selectedCicloId,
        pensum_curso_id: cursoQuizActivo.id,
        titulo: String(values.titulo || "").trim(),
        descripcion: values.descripcion || null,
        total_preguntas: Number(values.total_preguntas || 25),
        publicado: Boolean(values.publicado),
        activo: values.activo ?? true,
      };

      if (editingQuiz) {
        const { error } = await supabaseBrowserClient
          .from("quizzes_clase")
          .update(payload)
          .eq("id", editingQuiz.id);
        if (error) throw error;
        message.success("Quiz actualizado");
      } else {
        const { error } = await supabaseBrowserClient
          .from("quizzes_clase")
          .upsert(payload, { onConflict: "pensum_curso_id" });
        if (error) throw error;
        message.success("Quiz creado para la clase");
      }

      setModalQuizVisible(false);
      setEditingQuiz(null);
      setCursoQuizActivo(null);
      formQuiz.resetFields();
      await cargarQuizzesClase();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "Error al guardar quiz");
      } else {
        message.error("Error al guardar quiz");
      }
    }
  };

  const handleEliminarQuiz = (quizId: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar quizzes.");
      return;
    }

    modal.confirm({
      title: "Eliminar quiz de la clase",
      content: "¿Seguro que deseas eliminar este quiz?",
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("quizzes_clase")
            .delete()
            .eq("id", quizId);

          if (error) throw error;
          message.success("Quiz eliminado");
          await cargarQuizzesClase();
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message || "Error al eliminar quiz");
          } else {
            message.error("Error al eliminar quiz");
          }
        }
      },
    });
  };

  const abrirModalMaterialClase = (cursoId: string, material?: MaterialClase) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    setEditingMaterialClase(material || null);
    formMaterialClase.setFieldsValue({
      pensum_curso_id: material?.pensum_curso_id || cursoId,
      material_ciclo_id: material?.material_ciclo_id || null,
      material_ciclo_ids: material?.material_ciclo_id ? [material.material_ciclo_id] : [],
      nombre_material: material?.nombre_material || "",
      cantidad: material?.cantidad || "",
      unidad: material?.unidad || "",
      observaciones: material?.observaciones || "",
      orden: material?.orden ?? 1,
      activo: material?.activo ?? true,
    });
    setModalMaterialClaseVisible(true);
  };

  const handleGuardarMaterialClase = async () => {
    try {
      if (!canManageMateriales) {
        message.warning("Solo administración y secretaría pueden gestionar materiales.");
        return;
      }
      if (!selectedCicloId) return;
      const values = await formMaterialClase.validateFields();

      const selectedMaterialIds = Array.isArray(values.material_ciclo_ids)
        ? values.material_ciclo_ids.filter(Boolean)
        : [];

      const materialCicloSeleccionado = materialesCicloGeneral.find(
        (material) => String(material.id) === String(values.material_ciclo_id),
      );
      const nombreMaterial = values.nombre_material || materialCicloSeleccionado?.nombre || "";
      const cantidadMaterial = values.cantidad || materialCicloSeleccionado?.cantidad || null;

      const obligatorio = editingMaterialClase?.obligatorio ?? true;
      const payload = {
        programa_id: Number(programaId),
        pensum_id: selectedCicloId,
        pensum_curso_id: values.pensum_curso_id,
        material_ciclo_id: values.material_ciclo_id || null,
        nombre_material: nombreMaterial,
        cantidad: cantidadMaterial,
        unidad: values.unidad || null,
        observaciones: values.observaciones || null,
        obligatorio,
        orden: values.orden || 1,
        activo: true,
      };

      if (editingMaterialClase) {
        const { error } = await supabaseBrowserClient
          .from("materiales_clase")
          .update(payload)
          .eq("id", editingMaterialClase.id);
        if (error) throw error;
        message.success("Material necesario actualizado");
      } else {
        if (selectedMaterialIds.length > 1) {
          const payloads = selectedMaterialIds.map((materialId: string, index: number) => {
            const selected = materialesCicloGeneral.find((material) => String(material.id) === String(materialId));
            return {
              ...payload,
              material_ciclo_id: materialId,
              nombre_material: selected?.nombre || payload.nombre_material,
              cantidad: selected?.cantidad || payload.cantidad,
              orden: (values.orden || 1) + index,
            };
          });

          const { error } = await supabaseBrowserClient
            .from("materiales_clase")
            .insert(payloads);
          if (error) throw error;
          message.success(`${payloads.length} materiales necesarios agregados`);
        } else {
          const materialId = selectedMaterialIds[0] || values.material_ciclo_id || null;
          const selected = materialId
            ? materialesCicloGeneral.find((material) => String(material.id) === String(materialId))
            : null;

          const payloadSingle = {
            ...payload,
            material_ciclo_id: materialId,
            nombre_material: selected?.nombre || payload.nombre_material,
            cantidad: selected?.cantidad || payload.cantidad,
          };

          const { error } = await supabaseBrowserClient
            .from("materiales_clase")
            .insert([payloadSingle]);
          if (error) throw error;
          message.success("Material necesario agregado");
        }
      }

      setModalMaterialClaseVisible(false);
      setEditingMaterialClase(null);
      formMaterialClase.resetFields();
      await cargarMaterialesClase();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "Error al guardar material necesario");
      } else {
        message.error("Error al guardar material necesario");
      }
    }
  };

  const handleEliminarMaterialClase = (materialId: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    modal.confirm({
      title: "Eliminar material necesario",
      content: "¿Estás seguro?",
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("materiales_clase")
            .update({ activo: false })
            .eq("id", materialId);
          if (error) throw error;
          message.success("Material necesario eliminado");
          await cargarMaterialesClase();
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message || "Error");
          } else {
            message.error("Error");
          }
        }
      },
    });
  };

  const abrirModalMaterialCiclo = (material?: MaterialCiclo) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    setEditingMaterialCiclo(material || null);
    formMaterialCiclo.setFieldsValue({
      nombre: material?.nombre || "",
      cantidad: material?.cantidad || "",
      incluido_kit: material?.incluido_kit ?? false,
      orden: material?.orden ?? 1,
      activo: material?.activo ?? true,
    });
    setModalMaterialCicloVisible(true);
  };

  const handleGuardarMaterialCiclo = async () => {
    try {
      if (!canManageMateriales) {
        message.warning("Solo administración y secretaría pueden gestionar materiales.");
        return;
      }
      if (!selectedCicloId) {
        message.error("Selecciona un ciclo antes de agregar materiales.");
        return;
      }

      const values = await formMaterialCiclo.validateFields();
      const payload = {
        programa_id: Number(programaId),
        pensum_id: selectedCicloId,
        nombre: values.nombre,
        cantidad: values.cantidad || null,
        incluido_kit: Boolean(values.incluido_kit),
        orden: values.orden || 1,
        activo: values.activo ?? true,
      };

      if (editingMaterialCiclo) {
        const { error } = await supabaseBrowserClient
          .from("materiales_ciclo")
          .update(payload)
          .eq("id", editingMaterialCiclo.id);
        if (error) throw error;
        message.success("Material del ciclo actualizado");
      } else {
        const { error } = await supabaseBrowserClient
          .from("materiales_ciclo")
          .insert([payload]);
        if (error) throw error;
        message.success("Material del ciclo agregado");
      }

      setModalMaterialCicloVisible(false);
      setEditingMaterialCiclo(null);
      formMaterialCiclo.resetFields();
      await cargarMaterialesCiclo();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message || "Error al guardar material del ciclo");
      } else {
        message.error("Error al guardar material del ciclo");
      }
    }
  };

  const handleEliminarMaterialCiclo = (materialId: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    modal.confirm({
      title: "Eliminar material del ciclo",
      content: "¿Estás seguro?",
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("materiales_ciclo")
            .update({ activo: false })
            .eq("id", materialId);
          if (error) throw error;
          message.success("Material del ciclo eliminado");
          await cargarMaterialesCiclo();
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message || "Error");
          } else {
            message.error("Error");
          }
        }
      },
    });
  };

  useEffect(() => {
    cargarPrograma();
    cargarRolActual();
  }, [cargarPrograma, cargarRolActual]);

  useEffect(() => {
    if (programaData) {
      verificarYCrearCiclos();
    }
  }, [programaData, verificarYCrearCiclos]);

  useEffect(() => {
    cargarPensums();
  }, [cargarPensums]);

  useEffect(() => {
    cargarCursosPrograma();
  }, [pensums, cargarCursosPrograma]);

  useEffect(() => {
    if (selectedCicloId) {
      const cicloSeleccionado = pensums.find(p => p.id === selectedCicloId);
      if (cicloSeleccionado) {
        cargarCursosPensum(selectedCicloId);
      }
    }
  }, [selectedCicloId, pensums, cargarCursosPensum]);

  useEffect(() => {
    cargarMateriales();
  }, [cargarMateriales]);

  useEffect(() => {
    cargarMaterialesCiclo();
  }, [cargarMaterialesCiclo]);

  useEffect(() => {
    cargarMaterialesClase();
  }, [cargarMaterialesClase]);

  useEffect(() => {
    cargarQuizzesClase();
  }, [cargarQuizzesClase]);

  const parseTemaFromTitulo = (titulo: string) => {
    const match = titulo.match(/^\s*(?:\[?tema[:\-]\s*)(.+?)(?:\]|—|–|-|:)\s*(.+)?$/i);
    if (!match) return { tema: undefined, tituloLimpio: titulo };
    const tema = match[1]?.trim();
    const tituloLimpio = (match[2] || titulo).trim();
    return { tema, tituloLimpio };
  };

  const normalizarTema = (valor?: string) =>
    String(valor || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/^\d+\s*[\.)\-:]\s*/, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const buildTituloConTema = (titulo: string, tema?: string) => {
    if (!tema) return titulo;
    if (/^\s*tema[:\-]/i.test(titulo) || /^\s*\[tema[:\-]/i.test(titulo)) return titulo;
    return `Tema: ${tema} — ${titulo}`;
  };

  const abrirDrawerMaterialParaTema = (temaNombre?: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    setEditingMaterial(null);
    formMaterial.resetFields();
    setFileList([]);
    setTipoOrigen('archivo');
    formMaterial.setFieldsValue({ tema_relacionado: temaNombre });
    setDrawerMaterialesVisible(true);
  };

  const editarMaterial = (material: MaterialDidactico, temaNombre?: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    const esIframe = material.mime_type === "iframe";
    const esEnlace = !esIframe && (material.mime_type === "link" || material.nombre_archivo === "Enlace Externo");
    setEditingMaterial(material);
    setFileList([]);
    setTipoOrigen(esIframe ? 'iframe' : esEnlace ? 'enlace' : 'archivo');
    const iframeSrc = extractIframeSrc(material.url_archivo);
    formMaterial.setFieldsValue({
      tema_relacionado: temaNombre,
      titulo: material.titulo,
      descripcion: material.descripcion,
      tipo_material: material.tipo_material,
      url_externa: esEnlace ? material.url_archivo : undefined,
      iframe_code: esIframe && iframeSrc ? `<iframe src="${iframeSrc}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>` : undefined,
    });
    setDrawerMaterialesVisible(true);
  };

  const materialesCicloDidactico = useMemo(() => {
    return materiales.filter(m => m.pensum_id === selectedCicloId);
  }, [materiales, selectedCicloId]);

  const materialesCicloGeneralOrdenados = useMemo(() => {
    return materialesCicloGeneral
      .filter((m) => m.pensum_id === selectedCicloId)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  }, [materialesCicloGeneral, selectedCicloId]);

  const materialesClaseCiclo = useMemo(() => {
    return materialesClase.filter((material) => material.pensum_id === selectedCicloId);
  }, [materialesClase, selectedCicloId]);


  const handleEliminarMaterial = (materialId: string) => {
    if (!canManageMateriales) {
      message.warning("Solo administración y secretaría pueden gestionar materiales.");
      return;
    }
    modal.confirm({
      title: "Eliminar material",
      content: "¿Estás seguro?",
      okText: "Eliminar",
      okType: "danger",
      onOk: async () => {
        try {
          const { error } = await supabaseBrowserClient
            .from("material_didactico")
            .delete()
            .eq("id", materialId);
          if (error) throw error;
          message.success("Material eliminado");
          cargarMateriales();
        } catch (error) {
          if (error instanceof Error) {
            message.error(error.message || "Error");
          } else {
            message.error("Error");
          }
        }
      },
    });
  };

  const formatearTamano = (bytes: number) => {
    if (bytes === 0) return "Enlace";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const sanitizarNombreArchivo = (nombre: string) => {
    return nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120);
  };

  // Actualizar pensum_id cuando se selecciona un ciclo para subir material
  const handleSubirMaterial = async () => {
    try {
      if (!canManageMateriales) {
        message.warning("Solo administración y secretaría pueden gestionar materiales.");
        return;
      }
      if (!selectedCicloId) {
        message.error("Selecciona un ciclo antes de subir material.");
        return;
      }
      // Obtener valores del formulario
      const formValues = formMaterial.getFieldsValue();
      const tipoOrigenSeleccionado = tipoOrigen;
      const temaRelacionado = formValues.tema_relacionado as string | undefined;
      
      let urlArchivo = "";
      let nombreArchivo = "";
      let tamanoBytes = 0;
      let mimeType = "";

      if (tipoOrigenSeleccionado === 'archivo') {
        // Obtener el archivo del upload
        const fileList = formValues.archivo?.fileList;
        if (!fileList || fileList.length === 0) {
          if (!editingMaterial) {
            message.error("Por favor selecciona un archivo");
            return;
          }
        }

        if (fileList && fileList.length > 0) {
          const uploadedFile = fileList[0].originFileObj;
          const safeName = sanitizarNombreArchivo(uploadedFile.name);
          const uploadFileName = `${Date.now()}_${safeName}`;

          // Subir archivo a Supabase Storage
          const { data: uploadData, error: uploadError } = await supabaseBrowserClient.storage
            .from("material_didactico")
            .upload(`${programaId}/${uploadFileName}`, uploadedFile);

          if (uploadError) {
            if (
              uploadError.message.includes("security policy") ||
              uploadError.message.includes("row-level security")
            ) {
              throw new Error(
                "Error de permisos: Falta configurar políticas RLS en el bucket 'material_didactico'. Ejecuta el script SQL de permisos."
              );
            }
            throw uploadError;
          }

          // Obtener URL pública
          const { data: urlData } = supabaseBrowserClient.storage
            .from("material_didactico")
            .getPublicUrl(`${programaId}/${uploadFileName}`);

          urlArchivo = urlData.publicUrl;
          nombreArchivo = uploadedFile.name;
          tamanoBytes = uploadedFile.size;
          mimeType = uploadedFile.type;
        } else if (editingMaterial) {
          urlArchivo = editingMaterial.url_archivo;
          nombreArchivo = editingMaterial.nombre_archivo;
          tamanoBytes = editingMaterial.tamano_bytes;
          mimeType = editingMaterial.mime_type;
        }
      } else if (tipoOrigenSeleccionado === 'enlace') {
        // Es un enlace externo
        urlArchivo = normalizeHttpUrl(formValues.url_externa);
        if (!isHttpUrl(urlArchivo)) {
          throw new Error("La URL del enlace debe iniciar con http:// o https://");
        }
        nombreArchivo = "Enlace Externo";
        tamanoBytes = 0;
        mimeType = "link";
      } else if (tipoOrigenSeleccionado === 'iframe') {
        const iframeCode = String(formValues.iframe_code || "").trim();
        const iframeSrc = extractIframeSrc(iframeCode);

        if (!iframeCode) {
          throw new Error("Pega el código iframe de Gamma.");
        }

        if (!isHttpUrl(iframeSrc)) {
          throw new Error("No se pudo detectar una URL válida dentro del iframe.");
        }

        if (hasMalformedEmbedTokens(iframeSrc)) {
          throw new Error("El iframe contiene parámetros inválidos. Vuelve a copiar el código de Gamma.");
        }

        if (!isAllowedEmbedHost(iframeSrc)) {
          throw new Error("Solo se permiten iframes de Gamma (gamma.app).");
        }

        urlArchivo = iframeSrc;
        nombreArchivo = "Presentación embebida";
        tamanoBytes = 0;
        mimeType = "iframe";
      }
                setTipoOrigen('archivo');

      // Guardar en base de datos
      const { data: authData } = await supabaseBrowserClient.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) {
               <Radio.Button value="iframe">Código iframe (Gamma)</Radio.Button>
        message.error("Debes iniciar sesión para subir material");
        return;
      }

      const payload = {
        programa_id: programaId,
        pensum_id: selectedCicloId,
        subido_por: authUser.id,
        titulo: buildTituloConTema(formValues.titulo, temaRelacionado),
        descripcion: formValues.descripcion,
        tipo_material: formValues.tipo_material || tipoOrigenSeleccionado,
        url_archivo: urlArchivo,
        nombre_archivo: nombreArchivo,
        tamano_bytes: tamanoBytes,
        mime_type: mimeType,
        visible: true,
      };

      if (editingMaterial) {
        const { error: updateError } = await supabaseBrowserClient
          .from("material_didactico")
          .update(payload)
          .eq("id", editingMaterial.id);

        if (updateError) throw updateError;
        message.success("Material actualizado correctamente");
      } else {
        const { error: insertError } = await supabaseBrowserClient
          .from("material_didactico")
          .insert(payload);

        if (insertError) throw insertError;
        message.success("Material subido correctamente");
      }

      formMaterial.resetFields();
      setDrawerMaterialesVisible(false);
      setFileList([]);
      setTipoOrigen('archivo');
      setEditingMaterial(null);
      await cargarMateriales();
      
    } catch (error: any) {
      message.error("Error al subir material: " + error.message);
      console.error(error);
    }
  };

  const handleAbrirMaterial = (url: string, title?: string) => {
    logger.debug("Intentando abrir URL:", url);
    if (!url) {
      message.error("Error: El material no tiene una URL válida");
      return;
    }

    const normalizedUrl = normalizeHttpUrl(url);
    if (!normalizedUrl) {
      message.error("Error: El material no tiene una URL válida");
      return;
    }

    if (isAllowedEmbedHost(normalizedUrl)) {
      setIframePreview({
        open: true,
        title: String(title || "Presentación").trim() || "Presentación",
        src: toGammaEmbedUrl(normalizedUrl),
      });
      return;
    }

    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
  };

  const cicloSeleccionado = pensums.find((p) => p.id === selectedCicloId) || null;
  const totalTemas = cursosPensum.length;
  const totalTemasPrograma = cursosPrograma.length;
  const totalClasesEsperadasPrograma = Number(programaData?.total_clases || 0);
  const faltantesPrograma = totalClasesEsperadasPrograma > 0
    ? Math.max(0, totalClasesEsperadasPrograma - totalTemasPrograma)
    : 0;
  const totalMaterialDidactico = materialesCicloDidactico.length;
  const totalMaterialNecesario = materialesClaseCiclo.length;
  const quizzesPorTemaId = useMemo(() => {
    const map = new Map<string, QuizClase>();
    (quizzesClase || []).forEach((quiz) => {
      const key = String(quiz?.pensum_curso_id || "");
      if (!key) return;
      map.set(key, quiz);
    });
    return map;
  }, [quizzesClase]);

  const clasesMaestrasPrograma = useMemo(() => {
    const cicloOrderById = new Map<string, number>();
    const cicloLabelById = new Map<string, string>();

    (pensums || []).forEach((ciclo) => {
      const key = String(ciclo?.id || "");
      if (!key) return;
      cicloOrderById.set(key, Number(ciclo?.orden || ciclo?.numero_ciclo || 9999));
      cicloLabelById.set(key, ciclo?.nombre_ciclo || `Ciclo ${ciclo?.numero_ciclo || "?"}`);
    });

    return (cursosPrograma || []).map((curso, index) => {
      const cicloId = String(curso?.pensum_id || "");
      return {
        id: String(curso?.id || `clase-${index + 1}`),
        key: String(curso?.id || `clase-${index + 1}`),
        numero: index + 1,
        cicloId,
        cicloOrden: cicloOrderById.get(cicloId) ?? 9999,
        cicloNombre: cicloLabelById.get(cicloId) || "Sin ciclo",
        tema: curso?.nombre_curso || `Clase ${index + 1}`,
        descripcion: curso?.descripcion || "",
        horas: Number(curso?.horas || 0),
        tipo: curso?.tipo_curso || "obligatorio",
        quiz: quizzesPorTemaId.get(String(curso?.id || "")) || null,
      };
    });
  }, [cursosPrograma, pensums, quizzesPorTemaId]);

  const abrirClaseDesdeTabla = useCallback((record: any) => {
    const cicloId = String(record?.cicloId || "");
    if (cicloId) {
      setSelectedCicloId(cicloId);
    }
  }, []);

  const editarNombreClaseDesdeTabla = useCallback((record: any) => {
    const curso = (cursosPrograma || []).find((item) => String(item?.id) === String(record?.id));
    if (!curso) return;

    const cicloId = String(curso?.pensum_id || record?.cicloId || "");
    if (cicloId) {
      setSelectedCicloId(cicloId);
    }

    setEditingCurso(curso);
    formCurso.setFieldsValue(curso);
    setModalCursoVisible(true);
  }, [cursosPrograma, formCurso]);

  return (
    <Drawer
      title={`Gestión: ${programaNombre}`}
      placement="right"
      open={true}
      onClose={onClose}
      width={1200}
      destroyOnClose
    >
      {/* Vista Principal - Seleccionar Ciclo */}
      {!selectedCicloId ? (
        <div>
          {programaData && (
            <Alert
              message={`Ciclos generados automáticamente`}
              description={`Este programa tiene configurados ${pensums.length} ciclo(s) según la duración "${programaData.duracion}". Clases del programa: ${totalTemasPrograma}${totalClasesEsperadasPrograma > 0 ? ` / ${totalClasesEsperadasPrograma}` : ""}. Selecciona un ciclo para gestionar sus temas y materiales.`}
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          <Card size="small" style={{ marginBottom: 16 }}>
            <Space wrap size={12}>
              <Tag color={faltantesPrograma > 0 ? "orange" : "green"}>
                Lista de clases: {totalTemasPrograma}{totalClasesEsperadasPrograma > 0 ? ` / ${totalClasesEsperadasPrograma}` : ""}
              </Tag>
              {totalClasesEsperadasPrograma > 0 && (
                <Button type="primary" onClick={sincronizarListaClasesPrograma}>
                  {faltantesPrograma > 0 ? `Completar ${faltantesPrograma} clases faltantes` : "Sincronizar lista de clases"}
                </Button>
              )}
            </Space>
          </Card>

          <Card
            size="small"
            title="Tabla maestra de clases (vista completa)"
            style={{ marginBottom: 16 }}
            extra={(
              <Button
                type={mostrarTablaMaestraClases ? "primary" : "default"}
                onClick={() => setMostrarTablaMaestraClases((prev) => !prev)}
              >
                {mostrarTablaMaestraClases ? "Ocultar tabla" : "Ver tabla completa"}
              </Button>
            )}
          >
            {!mostrarTablaMaestraClases ? (
              <Text type="secondary">Pulsa &quot;Ver tabla completa&quot; para visualizar y gestionar todas las clases de una sola mirada.</Text>
            ) : clasesMaestrasPrograma.length === 0 ? (
              <Text type="secondary">Aún no hay clases creadas en el programa.</Text>
            ) : (
              <Table
                size="small"
                loading={loadingQuizzesClase}
                rowKey="key"
                dataSource={clasesMaestrasPrograma}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                scroll={{ x: 980 }}
                columns={[
                  {
                    title: "Clase #",
                    dataIndex: "numero",
                    width: 90,
                    sorter: (a, b) => Number(a.numero) - Number(b.numero),
                  },
                  {
                    title: "Ciclo",
                    dataIndex: "cicloNombre",
                    width: 240,
                    render: (value: string) => <Tag color="blue">{value}</Tag>,
                  },
                  {
                    title: "Tema/Clase",
                    dataIndex: "tema",
                    width: 360,
                    render: (value: string) => (
                      <Text style={{ display: "block" }} ellipsis={{ tooltip: value }}>
                        {value}
                      </Text>
                    ),
                  },
                  {
                    title: "Horas",
                    dataIndex: "horas",
                    width: 90,
                    align: "center",
                    render: (v: number) => (v > 0 ? v : "-"),
                  },
                  {
                    title: "Tipo",
                    dataIndex: "tipo",
                    width: 130,
                    render: (v: string) => <Tag>{v || "obligatorio"}</Tag>,
                  },
                  {
                    title: "Acciones",
                    key: "acciones",
                    width: 170,
                    render: (_: any, record: any) => (
                      <Space size={8}>
                        <Button size="small" onClick={() => abrirClaseDesdeTabla(record)}>
                          Entrar
                        </Button>
                        <Button size="small" type="primary" ghost onClick={() => editarNombreClaseDesdeTabla(record)}>
                          Editar nombre
                        </Button>
                      </Space>
                    ),
                  },
                ]}
              />
            )}
          </Card>

          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ fontSize: 16 }}>
              Elige un ciclo para gestionar temas y subir materiales
            </Text>
          </div>

          {pensums.length === 0 ? (
            <Empty description="No hay ciclos creados" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              {pensums.map((pensum) => (
                <Card
                  key={pensum.id}
                  hoverable
                  onClick={() => setSelectedCicloId(pensum.id)}
                  style={{
                    cursor: "pointer",
                    textAlign: "center",
                    borderRadius: 8,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    position: "relative",
                  }}
                >
                  <Button 
                    type="text" 
                    icon={<EditOutlined />} 
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: '#1890ff' }}
                    onClick={(e) => handleEditarCiclo(e, pensum)}
                  />
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
                  <Text strong style={{ fontSize: 18, display: "block" }}>
                    {pensum.nombre_ciclo || `Ciclo ${pensum.numero_ciclo}`}
                  </Text>
                  {pensum.nombre_ciclo && (
                    <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                      Ciclo {pensum.numero_ciclo}
                    </div>
                  )}
                  {pensum.descripcion && (
                    <div style={{ fontSize: 12, color: "#888", marginTop: 8, fontStyle: 'italic', padding: '0 10px' }}>
                      {pensum.descripcion}
                    </div>
                  )}
                  <Divider style={{ margin: "12px 0" }} />
                  <div style={{ fontSize: 12, color: "#999" }}>
                    <div>⏱️ {pensum.duracion_semanas} semanas</div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Vista Ciclo Seleccionado - Ver Temas y Materiales */
        <div>
          <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <Button onClick={() => setSelectedCicloId(null)}>← Volver</Button>
            <div>
              <Text strong style={{ fontSize: 18 }}>
                {cicloSeleccionado?.nombre_ciclo || `Ciclo ${cicloSeleccionado?.numero_ciclo}`}
              </Text>
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            message="Guía rápida"
            description={
              <Space direction="vertical" size={2}>
                <Text>1) Crea los temas del ciclo.</Text>
                <Text>2) En cada tema, sube su material didáctico.</Text>
                <Text>3) Registra materiales necesarios para clase.</Text>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />

          <Card size="small" style={{ marginBottom: 16 }}>
            <Space wrap size={12}>
              <Tag color="blue">Temas: {totalTemas}</Tag>
              <Tag color={faltantesPrograma > 0 ? "orange" : "green"}>
                Programa: {totalTemasPrograma}{totalClasesEsperadasPrograma > 0 ? ` / ${totalClasesEsperadasPrograma}` : ""}
              </Tag>
              <Tag color="purple">Material didáctico: {totalMaterialDidactico}</Tag>
              <Tag color="green">Material necesario: {totalMaterialNecesario}</Tag>
              <Tag color="geekblue">Quizzes: {quizzesClase.length}</Tag>
              {totalClasesEsperadasPrograma > 0 && (
                <Button size="small" onClick={sincronizarListaClasesPrograma}>
                  Sincronizar clases del programa
                </Button>
              )}
            </Space>
          </Card>

          {!canManageMateriales && (
            <Alert
              type="warning"
              showIcon
              message="Modo solo lectura de materiales"
              description="Solo administración y secretaría pueden crear, editar o eliminar materiales."
              style={{ marginBottom: 16 }}
            />
          )}

          <Card
            size="small"
            title="Materiales del ciclo (lista general)"
            style={{ marginBottom: 16 }}
            extra={(
              <Space wrap>
                <Button
                  onClick={() => setMostrarListaCompletaCiclo((prev) => !prev)}
                >
                  {mostrarListaCompletaCiclo ? "Ver resumida" : "Ver lista completa"}
                </Button>
                {canManageMateriales ? (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => abrirModalMaterialCiclo()}
                  >
                    Agregar material del ciclo
                  </Button>
                ) : null}
              </Space>
            )}
          >
            {materialesCicloGeneralOrdenados.length === 0 ? (
              <Text type="secondary">No hay materiales generales registrados en este ciclo.</Text>
            ) : (
              <Table
                size="small"
                loading={loadingMaterialesCiclo}
                pagination={mostrarListaCompletaCiclo ? false : { pageSize: 8, hideOnSinglePage: true }}
                rowKey={(record) => String(record?.id || record?.nombre)}
                dataSource={materialesCicloGeneralOrdenados}
                columns={[
                  {
                    title: "Producto",
                    dataIndex: "nombre",
                    render: (value) => <Text>{value}</Text>,
                  },
                  {
                    title: "Cantidad",
                    dataIndex: "cantidad",
                    render: (value) => value || "Cantidad por definir",
                  },
                  {
                    title: "Kit",
                    dataIndex: "incluido_kit",
                    align: "center",
                    render: (value) => (value ? <GiftOutlined style={{ color: "#d81b87" }} /> : null),
                  },
                  {
                    title: "Quiz",
                    key: "quiz",
                    width: 180,
                    render: (_: any, record: any) => {
                      const quiz = record?.quiz;
                      if (!quiz) return <Tag>Sin quiz</Tag>;
                      return (
                        <Tag color={quiz.publicado ? "green" : "orange"}>
                          {quiz.publicado ? "Publicado" : "Borrador"}
                        </Tag>
                      );
                    },
                  },
                  ...(canManageMateriales
                    ? [
                        {
                          title: "Acciones",
                          key: "acciones",
                          align: "right" as const,
                          render: (_: any, record: MaterialCiclo) => (
                            <Space size={4}>
                              <Button
                                key={`editar-ciclo-${record.id}`}
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => abrirModalMaterialCiclo(record)}
                                style={{ padding: 0, height: "auto" }}
                              />
                              <Button
                                key={`eliminar-ciclo-${record.id}`}
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleEliminarMaterialCiclo(record.id)}
                                style={{ padding: 0, height: "auto" }}
                              />
                            </Space>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </Card>

          <div style={{ marginBottom: 16 }}>
            <Space wrap>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingCurso(null);
                  formCurso.resetFields();
                  setModalCursoVisible(true);
                }}
              >
                1. Agregar Tema
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  const primerTema = cursosPensum[0];
                  if (!primerTema) {
                    message.warning("Primero crea al menos un tema para subir material didáctico.");
                    return;
                  }
                  abrirDrawerMaterialParaTema(primerTema.nombre_curso);
                }}
              >
                2. Subir Material Didáctico
              </Button>
              <Button
                icon={<GiftOutlined />}
                onClick={() => {
                  const primerTema = cursosPensum[0];
                  if (!primerTema) {
                    message.warning("Primero debes crear al menos un tema para asociar materiales.");
                    return;
                  }
                  abrirModalMaterialClase(primerTema.id);
                }}
              >
                3. Agregar Material Necesario
              </Button>
              <Button onClick={() => setMostrarListaCompletaNecesarios((prev) => !prev)}>
                {mostrarListaCompletaNecesarios ? "Ver insumos resumidos" : "Ver lista completa de insumos"}
              </Button>
            </Space>
          </div>

          {cursosPensum.length === 0 ? (
            <Empty description="Sin temas en este ciclo" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {cursosPensum.map((curso) => {
                const materialesTema = materialesCicloDidactico.filter((material) => {
                  const { tema: temaMaterial } = parseTemaFromTitulo(material.titulo);
                  const temaMaterialNorm = normalizarTema(temaMaterial || material.titulo);
                  const temaCursoNorm = normalizarTema(curso.nombre_curso);
                  return temaMaterialNorm === temaCursoNorm;
                });
                const materialesNecesariosTema = materialesClaseCiclo.filter(
                  (material) => material.pensum_curso_id === curso.id,
                );
                const quizTema = quizzesPorTemaId.get(String(curso.id));

                return (
                  <Card
                    key={curso.id}
                    style={{
                      borderRadius: 8,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    extra={
                      <Dropdown
                        trigger={["click"]}
                        menu={{
                          items: [
                            ...(canManageMateriales
                              ? [
                                  {
                                    key: `subir-material-${curso.id}`,
                                    label: "Subir material",
                                    icon: <UploadOutlined />,
                                    onClick: () => abrirDrawerMaterialParaTema(curso.nombre_curso),
                                  },
                                  {
                                    key: `agregar-material-necesario-${curso.id}`,
                                    label: "Agregar material necesario",
                                    icon: <PlusOutlined />,
                                    onClick: () => abrirModalMaterialClase(curso.id),
                                  },
                                  {
                                    key: `gestionar-quiz-${curso.id}`,
                                    label: quizTema ? "Editar quiz" : "Crear quiz",
                                    icon: <CheckCircleOutlined />,
                                    onClick: () => abrirModalQuiz(curso, quizTema),
                                  },
                                ]
                              : []),
                            { type: "divider" as const },
                            {
                              key: `editar-tema-${curso.id}`,
                              label: "Editar tema",
                              icon: <EditOutlined />,
                              onClick: () => {
                                setEditingCurso(curso);
                                formCurso.setFieldsValue(curso);
                                setModalCursoVisible(true);
                              },
                            },
                            {
                              key: `eliminar-tema-${curso.id}`,
                              label: "Eliminar tema",
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => handleEliminarCurso(curso.id),
                            },
                          ],
                        }}
                      >
                        <Button type="text" icon={<EllipsisOutlined />} />
                      </Dropdown>
                    }
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                    <Text strong style={{ fontSize: 15, display: "block" }}>
                      {curso.nombre_curso}
                    </Text>
                    {curso.descripcion && (
                      <p
                        style={{
                          fontSize: 13,
                          color: "#666",
                          marginTop: 8,
                          marginBottom: 8,
                        }}
                      >
                        {curso.descripcion}
                      </p>
                    )}
                    <Divider style={{ margin: "8px 0" }} />
                    <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
                      <div>⏱️ {curso.horas || 0} horas</div>
                      {curso.creditos && (
                        <div>⭐ {curso.creditos} créditos</div>
                      )}
                      <Tag style={{ marginTop: 8 }} color="blue">
                        {curso.tipo_curso}
                      </Tag>
                    </div>

                    <Text strong style={{ fontSize: 13 }}>Material didáctico</Text>
                    {materialesTema.length === 0 ? (
                      <Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                        Sin material asignado
                      </Text>
                    ) : (
                      <List
                        size="small"
                        dataSource={materialesTema}
                        style={{ marginTop: 8 }}
                        renderItem={(material: MaterialDidactico) => (
                          <List.Item
                            actions={[
                              <Button
                                key={`ver-${material.id}`}
                                type="link"
                                onClick={() => handleAbrirMaterial(material.url_archivo, parseTemaFromTitulo(material.titulo).tituloLimpio || material.titulo)}
                                icon={material.mime_type === 'link' ? <LinkOutlined /> : <EyeOutlined />}
                                style={{ fontWeight: 500, padding: 0, height: 'auto' }}
                              />,
                              ...(canManageMateriales
                                ? [
                                    <Button
                                      key={`editar-${material.id}`}
                                      type="link"
                                      icon={<EditOutlined />}
                                      onClick={() => editarMaterial(material, curso.nombre_curso)}
                                      style={{ padding: 0, height: "auto" }}
                                    />,
                                    <Button
                                      key={`eliminar-${material.id}`}
                                      type="link"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleEliminarMaterial(material.id)}
                                      style={{ padding: 0, height: "auto" }}
                                    />,
                                  ]
                                : []),
                            ]}
                          >
                            <List.Item.Meta
                              avatar={
                                <div style={{ fontSize: 18, width: 24, textAlign: "center" }}>
                                  {material.tipo_material === "documento" && "📄"}
                                  {material.tipo_material === "video" && "🎥"}
                                  {material.tipo_material === "imagen" && "🖼️"}
                                  {material.tipo_material === "presentacion" && "📊"}
                                  {material.tipo_material === "recurso" && "🔧"}
                                  {material.tipo_material === "otro" && "📎"}
                                </div>
                              }
                              title={(() => {
                                const { tituloLimpio } = parseTemaFromTitulo(material.titulo);
                                return <Text>{tituloLimpio}</Text>;
                              })()}
                              description={null}
                            />
                          </List.Item>
                        )}
                      />
                    )}

                    <Divider style={{ margin: "10px 0" }} />
                    <Text strong style={{ fontSize: 13 }}>Quiz de clase</Text>
                    <div style={{ marginTop: 6, marginBottom: 10 }}>
                      {quizTema ? (
                        <Space size={8} wrap>
                          <Tag color={quizTema.publicado ? "green" : "orange"}>
                            {quizTema.publicado ? "Publicado" : "Borrador"}
                          </Tag>
                          <Tag>{quizTema.total_preguntas || 25} preguntas</Tag>
                          {canManageMateriales ? (
                            <>
                              <Button size="small" onClick={() => abrirModalQuiz(curso, quizTema)}>
                                Editar quiz
                              </Button>
                              <Button size="small" danger onClick={() => handleEliminarQuiz(quizTema.id)}>
                                Eliminar
                              </Button>
                            </>
                          ) : null}
                        </Space>
                      ) : (
                        <Space size={8} wrap>
                          <Text type="secondary">Sin quiz configurado para esta clase.</Text>
                          {canManageMateriales ? (
                            <Button size="small" type="primary" ghost onClick={() => abrirModalQuiz(curso, null)}>
                              Crear quiz
                            </Button>
                          ) : null}
                        </Space>
                      )}
                    </div>

                    <Divider style={{ margin: "10px 0" }} />
                    <Text strong style={{ fontSize: 13 }}>Materiales necesarios</Text>
                    {materialesNecesariosTema.length === 0 ? (
                      <Text type="secondary" style={{ display: "block", marginTop: 6 }}>
                        Sin materiales necesarios registrados
                      </Text>
                    ) : (
                      <Table
                        size="small"
                        loading={loadingMaterialesClase}
                        pagination={mostrarListaCompletaNecesarios ? false : { pageSize: 5, hideOnSinglePage: true }}
                        rowKey={(record) => String(record?.id || record?.nombre_material)}
                        dataSource={materialesNecesariosTema}
                        style={{ marginTop: 8 }}
                        columns={[
                          {
                            title: "Producto",
                            dataIndex: "nombre_material",
                            render: (_value, record) => <Text>{record.materiales_ciclo?.nombre || record.nombre_material}</Text>,
                          },
                          {
                            title: "Cantidad",
                            dataIndex: "cantidad",
                            render: (_value, record) =>
                              [record.materiales_ciclo?.cantidad || record.cantidad, record.unidad]
                                .filter(Boolean)
                                .join(" ") || "Cantidad no especificada",
                          },
                          {
                            title: "Kit",
                            dataIndex: "materiales_ciclo",
                            align: "center",
                            render: (value) => (value?.incluido_kit ? <GiftOutlined style={{ color: "#d81b87" }} /> : null),
                          },
                          ...(canManageMateriales
                            ? [
                                {
                                  title: "Acciones",
                                  key: "acciones",
                                  align: "right" as const,
                                  render: (_: any, record: MaterialClase) => (
                                    <Space size={4}>
                                      <Button
                                        key={`editar-necesario-${record.id}`}
                                        type="link"
                                        icon={<EditOutlined />}
                                        onClick={() => abrirModalMaterialClase(curso.id, record)}
                                        style={{ padding: 0, height: "auto" }}
                                      />
                                      <Button
                                        key={`eliminar-necesario-${record.id}`}
                                        type="link"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleEliminarMaterialClase(record.id)}
                                        style={{ padding: 0, height: "auto" }}
                                      />
                                    </Space>
                                  ),
                                },
                              ]
                            : []),
                        ]}
                      />
                    )}

                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Crear/Editar Tema */}
      <Modal
        title={editingCurso ? `Editar: ${editingCurso.nombre_curso}` : "Agregar Nuevo Tema"}
        open={modalCursoVisible}
        onOk={handleGuardarCurso}
        onCancel={() => {
          setModalCursoVisible(false);
          setEditingCurso(null);
          formCurso.resetFields();
        }}
      >
        <Form form={formCurso} layout="vertical">
          <Form.Item
            name="nombre_curso"
            label="Nombre del Tema"
            rules={[{ required: true, message: "El nombre es requerido" }]}
          >
            <Input placeholder="Ej: Introducción a React" />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} placeholder="Descripción breve del tema" />
          </Form.Item>

          <Form.Item name="horas" label="Horas">
            <InputNumber min={0} placeholder="0" />
          </Form.Item>

          <Form.Item name="creditos" label="Créditos">
            <InputNumber min={0} placeholder="0" />
          </Form.Item>

          <Form.Item
            name="tipo_curso"
            label="Tipo"
            rules={[{ required: true, message: "Selecciona un tipo" }]}
          >
            <Select
              options={[
                { label: "Obligatorio", value: "obligatorio" },
                { label: "Electivo", value: "electivo" },
                { label: "Complementario", value: "complementario" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Editar Ciclo */}
      <Modal
        title={`Editar Ciclo ${editingCiclo?.numero_ciclo}`}
        open={modalCicloVisible}
        onOk={handleGuardarCiclo}
        onCancel={() => setModalCicloVisible(false)}
      >
        <Form form={formCiclo} layout="vertical">
          <Form.Item 
            name="nombre_ciclo" 
            label="Nombre del Ciclo / Título"
            help="Ej: Introducción, Técnicas Avanzadas, etc."
          >
            <Input placeholder="Nombre descriptivo del ciclo" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} placeholder="¿Qué se aprenderá en este ciclo?" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingMaterialCiclo ? "Editar material del ciclo" : "Agregar material del ciclo"}
        open={modalMaterialCicloVisible}
        onOk={handleGuardarMaterialCiclo}
        onCancel={() => {
          setModalMaterialCicloVisible(false);
          setEditingMaterialCiclo(null);
          formMaterialCiclo.resetFields();
        }}
      >
        <Form form={formMaterialCiclo} layout="vertical">
          <Form.Item
            name="nombre"
            label="Nombre del material"
            rules={[{ required: true, message: "El nombre es requerido" }]}
          >
            <Input placeholder="Ej: Esmalte base" />
          </Form.Item>

          <Form.Item name="cantidad" label="Cantidad">
            <Input placeholder="Ej: 1 unidad, 2 ml" />
          </Form.Item>

          <Form.Item name="incluido_kit" label="Incluido en kit" initialValue={false}>
            <Select
              options={[
                { value: true, label: "Si, viene en el kit mensual" },
                { value: false, label: "No, el estudiante debe traerlo" },
              ]}
            />
          </Form.Item>

          <Form.Item name="orden" label="Orden" initialValue={1}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingQuiz ? "Editar quiz de clase" : "Crear quiz de clase"}
        open={modalQuizVisible}
        onOk={handleGuardarQuiz}
        onCancel={() => {
          setModalQuizVisible(false);
          setEditingQuiz(null);
          setCursoQuizActivo(null);
          formQuiz.resetFields();
        }}
      >
        <Form form={formQuiz} layout="vertical">
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={
              cursoQuizActivo
                ? `Tema: ${cursoQuizActivo.nombre_curso}`
                : "Selecciona un tema"
            }
            description="Configura aquí el quiz por clase. En el siguiente paso podremos cargar las 25 preguntas con sus respuestas correctas."
          />

          <Form.Item
            name="titulo"
            label="Título del quiz"
            rules={[{ required: true, message: "El título es obligatorio" }]}
          >
            <Input placeholder="Ej: Quiz Clase 5" />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} placeholder="Instrucciones para el estudiante" />
          </Form.Item>

          <Form.Item
            name="total_preguntas"
            label="Total de preguntas"
            initialValue={25}
            rules={[{ required: true, message: "Ingresa el total de preguntas" }]}
          >
            <InputNumber min={1} max={100} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="publicado" label="Estado de publicación" initialValue={false}>
            <Select
              options={[
                { value: false, label: "Borrador (no visible para estudiantes)" },
                { value: true, label: "Publicado (visible para estudiantes)" },
              ]}
            />
          </Form.Item>

          <Form.Item name="activo" label="Activo" initialValue={true}>
            <Select
              options={[
                { value: true, label: "Sí" },
                { value: false, label: "No" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingMaterialClase ? "Editar material necesario" : "Agregar material necesario"}
        open={modalMaterialClaseVisible}
        onOk={handleGuardarMaterialClase}
        onCancel={() => {
          setModalMaterialClaseVisible(false);
          setEditingMaterialClase(null);
          formMaterialClase.resetFields();
        }}
      >
        <Form form={formMaterialClase} layout="vertical">
          <Form.Item
            name="pensum_curso_id"
            label="Tema"
            rules={[{ required: true, message: "Selecciona un tema" }]}
          >
            <Select
              options={cursosPensum.map((curso) => ({
                value: curso.id,
                label: curso.nombre_curso,
              }))}
            />
          </Form.Item>

          <Form.Item
            name={editingMaterialClase ? "material_ciclo_id" : "material_ciclo_ids"}
            label="Material del ciclo (lista general)"
            rules={materialesCicloGeneralOrdenados.length > 0 ? [{ required: true, message: "Selecciona al menos un material del ciclo" }] : []}
          >
            <Select
              allowClear
              mode={editingMaterialClase ? undefined : "multiple"}
              showSearch
              optionFilterProp="label"
              placeholder={editingMaterialClase ? "Selecciona un material del ciclo" : "Selecciona uno o varios materiales del ciclo"}
              options={materialesCicloGeneralOrdenados.map((material) => ({
                value: material.id,
                label: material.incluido_kit
                  ? `${material.nombre} (Kit mensual)`
                  : material.nombre,
              }))}
              onChange={(value) => {
                const selectedIds = Array.isArray(value) ? value : [value].filter(Boolean);
                if (selectedIds.length !== 1) return;
                const selected = materialesCicloGeneralOrdenados.find((item) => String(item.id) === String(selectedIds[0]));
                if (!selected) return;
                if (!editingMaterialClase) {
                  formMaterialClase.setFieldsValue({
                    nombre_material: selected.nombre,
                    cantidad: selected.cantidad || "",
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item
            name="nombre_material"
            label="Material requerido"
            rules={[{ required: true, message: "El material es requerido" }]}
          >
            <Input placeholder="Ej: Cuaderno de dibujo" />
          </Form.Item>

          <Space style={{ width: "100%" }} align="start">
            <Form.Item name="cantidad" label="Cantidad" style={{ flex: 1 }}>
              <Input placeholder="Ej: 1" />
            </Form.Item>
            <Form.Item name="unidad" label="Unidad" style={{ flex: 1 }}>
              <Input placeholder="Ej: unidad(es), paquete" />
            </Form.Item>
          </Space>

          <Form.Item name="orden" label="Orden">
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="observaciones" label="Observaciones">
            <Input.TextArea rows={3} placeholder="Detalles adicionales del material" />
          </Form.Item>
        </Form>
      </Modal>

      {/* DRAWER: Subir Material Didáctico */}
      <Drawer
        title={editingMaterial ? "Editar Material Didáctico" : "Subir Material Didáctico"}
        placement="right"
        onClose={() => {
          setDrawerMaterialesVisible(false);
          setEditingMaterial(null);
          formMaterial.resetFields();
          setFileList([]);
          setTipoOrigen('archivo');
        }}
        open={drawerMaterialesVisible}
        width={500}
      >
        <Form form={formMaterial} layout="vertical">
          <Alert
            message={`Material para: ${pensums.find(p => p.id === selectedCicloId)?.nombre_ciclo || `Ciclo ${pensums.find(p => p.id === selectedCicloId)?.numero_ciclo}`}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="tema_relacionado"
            label="Tema relacionado (opcional)"
            help="Selecciona el tema para que el material quede claramente asociado."
          >
            <Select
              allowClear
              placeholder="Ej: Introducción, Herramientas, Técnica base"
              options={cursosPensum.map((curso) => ({
                value: curso.nombre_curso,
                label: curso.nombre_curso,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="titulo"
            label="Título del Material"
            rules={[{ required: true, message: "El título es requerido" }]}
          >
            <Input placeholder="Ej: Guía de Práctica 1" />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} placeholder="Descripción breve del material" />
          </Form.Item>

          <Form.Item
            name="tipo_material"
            label="Tipo de Material"
            rules={[{ required: true, message: "Selecciona un tipo" }]}
          >
            <Select
              options={[
                { label: "📄 Documento (PDF, Word)", value: "documento" },
                { label: "🎥 Video", value: "video" },
                { label: "🖼️ Imagen", value: "imagen" },
                { label: "📊 Presentación", value: "presentacion" },
                { label: "🔧 Recurso", value: "recurso" },
                { label: "📎 Otro", value: "otro" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Origen del Contenido" style={{ marginBottom: 12 }}>
             <Radio.Group 
               value={tipoOrigen} 
               onChange={(e) => setTipoOrigen(e.target.value)}
               buttonStyle="solid"
             >
               <Radio.Button value="archivo">Subir Archivo</Radio.Button>
               <Radio.Button value="enlace">Enlace (YouTube, Drive, etc.)</Radio.Button>
               <Radio.Button value="iframe">Código iframe (Gamma)</Radio.Button>
             </Radio.Group>
          </Form.Item>

          {tipoOrigen === 'archivo' ? (
            <Form.Item
              name="archivo"
              label="Archivo"
              rules={[{ required: true, message: "Selecciona un archivo" }]}
            >
              <Upload
                beforeUpload={() => false}
                fileList={fileList}
                onChange={(info) => setFileList(info.fileList)}
                maxCount={1}
              >
                <Button icon={<UploadOutlined />}>Seleccionar Archivo</Button>
              </Upload>
            </Form.Item>
          ) : tipoOrigen === 'enlace' ? (
            <Form.Item
              name="url_externa"
              label="URL del Enlace"
              rules={[
                { required: true, message: "Ingresa la URL" },
                { type: 'url', message: "Ingresa una URL válida (https://...)" }
              ]}
            >
              <Input prefix={<LinkOutlined />} placeholder="https://youtube.com/..." />
            </Form.Item>
          ) : (
            <Form.Item
              name="iframe_code"
              label="Código iframe de Gamma"
              rules={[{ required: true, message: "Pega el código iframe" }]}
              extra="Pega aquí el embed completo que te da Gamma."
            >
              <Input.TextArea
                rows={6}
                placeholder='<iframe src="https://gamma.app/embed/..." width="100%" height="600" frameborder="0" allowfullscreen></iframe>'
              />
            </Form.Item>
          )}

          <Space style={{ width: "100%" }}>
            <Button
              type="primary"
              loading={uploadingMaterial}
              onClick={handleSubirMaterial}
              block
            >
              Subir Material
            </Button>
            <Button
              onClick={() => {
                setDrawerMaterialesVisible(false);
                formMaterial.resetFields();
                setFileList([]);
                setTipoOrigen('archivo');
              }}
              block
            >
              Cancelar
            </Button>
          </Space>
        </Form>
      </Drawer>

      <Modal
        title={iframePreview.title || "Presentación"}
        open={iframePreview.open}
        onCancel={() => setIframePreview({ open: false, title: "", src: "" })}
        footer={null}
        width="100%"
        centered
        style={{ top: 0, padding: 0 }}
        styles={{ 
          body: { padding: 0, height: "100vh", overflow: "hidden" },
          content: { padding: 0, borderRadius: 0, height: "100vh", overflow: "hidden" }
        }}
        destroyOnClose
        className="gamma-fullscreen-modal"
      >
        {iframePreview.open && iframePreview.src ? (
          <iframe
            src={iframePreview.src}
            title={iframePreview.title || "Presentación"}
            style={{ width: "100%", height: "100%", border: 0 }}
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
            loading="lazy"
          />
        ) : null}
      </Modal>
    </Drawer>
  );
}
