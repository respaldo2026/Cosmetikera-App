"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Grid,
  Image,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  ShopOutlined,
  TagsOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import dayjs from "dayjs";
import { supabaseBrowserClient } from "@utils/supabase/client";

const { Title, Text } = Typography;
const { TextArea } = Input;

type MarketingAsset = {
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
  estado: string;
  visible_para_ia: boolean;
  categoria?: string;
  created_at: string;
  updated_at: string;
};

type ArticuloMarketing = {
  id: string;
  nombre: string;
  categoria?: string;
  marca?: string;
  precio_venta?: number;
  stock?: number;
  stock_minimo?: number;
  referencia?: string;
  descripcion?: string;
};

const tipoAssetOptions = [
  { value: "flyer", label: "Flyer", icon: <FileImageOutlined /> },
  { value: "pdf", label: "PDF", icon: <FilePdfOutlined /> },
  { value: "imagen", label: "Imagen", icon: <FileImageOutlined /> },
  { value: "video", label: "Video" },
  { value: "documento", label: "Documento", icon: <FileOutlined /> },
  { value: "otro", label: "Otro" },
];

const categoriaAssetOptions = [
  "promociones",
  "lanzamientos",
  "skincare",
  "maquillaje",
  "unas",
  "cabina",
  "fidelizacion",
  "whatsapp",
  "temporada",
  "tutoriales",
];

const estadoColors: Record<string, string> = {
  activo: "green",
  inactivo: "orange",
  archivado: "default",
};

const categoriasCosmeticaDefault = [
  "Esmaltes",
  "Bases y Tops",
  "Maquillaje",
  "Cuidado de piel",
  "Cejas y pestañas",
  "Accesorios",
  "Herramientas",
  "Insumos",
];

const formatMoney = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "Sin precio";
  return `$${value.toLocaleString("es-CO")}`;
};

export default function MarketingCenterPage() {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { message } = App.useApp();

  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [articulos, setArticulos] = useState<ArticuloMarketing[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadingArticulos, setLoadingArticulos] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string | undefined>(undefined);
  const [filterCategoria, setFilterCategoria] = useState<string | undefined>(undefined);
  const [soloIA, setSoloIA] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState("resumen");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MarketingAsset | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  const cargarAssets = async () => {
    setLoadingAssets(true);
    try {
      const { data, error } = await supabaseBrowserClient
        .from("marketing_assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssets((data as MarketingAsset[]) || []);
    } catch (error) {
      console.error("Error cargando assets:", error);
      message.error("No se pudieron cargar los materiales de marketing");
    } finally {
      setLoadingAssets(false);
    }
  };

  const cargarArticulos = async () => {
    setLoadingArticulos(true);
    try {
      const response = await fetch("/api/articulos", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "No se pudo cargar el catálogo");
      }
      setArticulos((payload.data as ArticuloMarketing[]) || []);
    } catch (error) {
      console.error("Error cargando artículos:", error);
      message.error("No se pudo cargar el catálogo comercial");
    } finally {
      setLoadingArticulos(false);
    }
  };

  useEffect(() => {
    const cargarDatosIniciales = async () => {
      try {
        await Promise.all([cargarAssets(), cargarArticulos()]);
      } finally {
        setInitialLoading(false);
      }
    };

    cargarDatosIniciales();
  }, []);

  const cargarTodo = async () => {
    await Promise.all([cargarAssets(), cargarArticulos()]);
  };

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const matchesSearch = searchTerm
        ? [asset.titulo, asset.descripcion, asset.descripcion_ia, asset.nombre_archivo, (asset.keywords || []).join(" ")]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
        : true;

      const matchesTipo = filterTipo ? asset.tipo_asset === filterTipo : true;
      const matchesCategoria = filterCategoria ? asset.categoria === filterCategoria : true;
      const matchesIA = soloIA ? asset.visible_para_ia : true;

      return matchesSearch && matchesTipo && matchesCategoria && matchesIA;
    });
  }, [assets, filterCategoria, filterTipo, searchTerm, soloIA]);

  const categoriasProducto = useMemo(() => {
    const dinamicas = articulos.map((item) => item.categoria).filter(Boolean) as string[];
    return [...new Set([...categoriasCosmeticaDefault, ...dinamicas])];
  }, [articulos]);

  const marcasProducto = useMemo(() => {
    return [...new Set(articulos.map((item) => item.marca).filter(Boolean) as string[])].sort();
  }, [articulos]);

  const productosDestacados = useMemo(() => {
    return [...articulos]
      .filter((item) => (item.stock || 0) > 0)
      .sort((left, right) => (right.precio_venta || 0) - (left.precio_venta || 0))
      .slice(0, 12);
  }, [articulos]);

  const stockBajo = useMemo(() => {
    return [...articulos]
      .filter((item) => (item.stock || 0) <= (item.stock_minimo ?? 3))
      .sort((left, right) => (left.stock || 0) - (right.stock || 0))
      .slice(0, 12);
  }, [articulos]);

  const categoriasSugeridas = useMemo(() => {
    const conteo = new Map<string, number>();
    articulos.forEach((item) => {
      if (!item.categoria) return;
      conteo.set(item.categoria, (conteo.get(item.categoria) || 0) + 1);
    });
    return [...conteo.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([nombre, total]) => ({ nombre, total }));
  }, [articulos]);

  const stats = useMemo(() => {
    return {
      totalAssets: assets.length,
      visiblesIA: assets.filter((asset) => asset.visible_para_ia).length,
      categorias: categoriasProducto.length,
      marcas: marcasProducto.length,
    };
  }, [assets, categoriasProducto.length, marcasProducto.length]);

  const contextoComercial = useMemo(() => {
    const categoriasText = categoriasSugeridas.length
      ? categoriasSugeridas.map((item) => `- ${item.nombre}: ${item.total} referencias`).join("\n")
      : "(Sin categorías activas todavía)";

    const marcasText = marcasProducto.length
      ? marcasProducto.slice(0, 12).map((marca) => `- ${marca}`).join("\n")
      : "(Sin marcas registradas)";

    const productosText = productosDestacados.length
      ? productosDestacados
          .map((item) => {
            const categoria = item.categoria ? ` | ${item.categoria}` : "";
            const marca = item.marca ? ` | ${item.marca}` : "";
            const precio = ` | ${formatMoney(item.precio_venta)}`;
            return `- ${item.nombre}${categoria}${marca}${precio}`;
          })
          .join("\n")
      : "(Sin productos destacados disponibles)";

    const stockText = stockBajo.length
      ? stockBajo
          .map((item) => `- ${item.nombre} | stock ${item.stock || 0} | mínimo ${item.stock_minimo ?? 3}`)
          .join("\n")
      : "(Sin alertas de stock bajo)";

    return [
      "Contexto comercial de La Cosmetikera",
      "",
      "Líneas con más movimiento:",
      categoriasText,
      "",
      "Marcas activas:",
      marcasText,
      "",
      "Productos sugeridos para campañas:",
      productosText,
      "",
      "Productos que conviene rotar o empujar en comunicación:",
      stockText,
    ].join("\n");
  }, [categoriasSugeridas, marcasProducto, productosDestacados, stockBajo]);

  const ideasCampana = useMemo(() => {
    const topCategoria = categoriasSugeridas[0]?.nombre || "maquillaje";
    const topMarca = marcasProducto[0] || "la marca principal";
    return [
      `Campaña de rotación: impulsar ${topCategoria.toLowerCase()} con combo de ticket medio + pieza para WhatsApp.`,
      `Campaña de marca: destacar novedades o reposición de ${topMarca}.`,
      "Campaña de fidelización: cruzar materiales de promociones con beneficios del club para recompra.",
    ];
  }, [categoriasSugeridas, marcasProducto]);

  const handleUpload = async (values: Record<string, any>) => {
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

      if (fileList.length > 0) {
        const fileItem = fileList[0] as UploadFile;
        const file = (fileItem as any)?.originFileObj as File | undefined;

        if (!file) {
          throw new Error("No se pudo leer el archivo seleccionado");
        }

        const fileExt = file.name.split(".").pop() || "bin";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabaseBrowserClient.storage
          .from("marketing")
          .upload(fileName, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabaseBrowserClient.storage.from("marketing").getPublicUrl(uploadData.path);

        urlArchivo = publicUrl;
        nombreArchivo = file.name;
        tamanoBytes = file.size;
        mimeType = file.type;
      }

      const payload = {
        titulo: values.titulo,
        descripcion: values.descripcion || null,
        tipo_asset: values.tipo_asset,
        url_archivo: urlArchivo,
        nombre_archivo: nombreArchivo,
        tamano_bytes: tamanoBytes,
        mime_type: mimeType,
        descripcion_ia: values.descripcion_ia,
        keywords: values.keywords
          ? String(values.keywords)
              .split(",")
              .map((keyword) => keyword.trim())
              .filter(Boolean)
          : [],
        estado: values.estado || "activo",
        visible_para_ia: values.visible_para_ia !== false,
        categoria: values.categoria || null,
        programa_id: null,
        curso_id: null,
      };

      if (editingAsset) {
        const { error } = await supabaseBrowserClient
          .from("marketing_assets")
          .update(payload)
          .eq("id", editingAsset.id);

        if (error) throw error;
        message.success("Material actualizado correctamente");
      } else {
        const { error } = await supabaseBrowserClient.from("marketing_assets").insert(payload);

        if (error) throw error;
        message.success("Material creado correctamente");
      }

      setModalVisible(false);
      setEditingAsset(null);
      setFileList([]);
      form.resetFields();
      await cargarAssets();
    } catch (error: any) {
      console.error("Error guardando asset:", error);
      message.error(error?.message || "No se pudo guardar el material");
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

      if (path) {
        const { error: storageError } = await supabaseBrowserClient.storage
          .from("marketing")
          .remove([path]);

        if (storageError) {
          console.error("Error eliminando archivo en Storage:", storageError);
          message.error("No se pudo eliminar el archivo del bucket de marketing");
          return;
        }
      }

      const { error } = await supabaseBrowserClient
        .from("marketing_assets")
        .delete()
        .eq("id", record.id);

      if (error) throw error;
      message.success("Material eliminado correctamente");
      await cargarAssets();
    } catch (error) {
      console.error("Error eliminando asset:", error);
      message.error("No se pudo eliminar el material");
    }
  };

  const handleToggleVisibilidadIA = async (record: MarketingAsset) => {
    try {
      const { error } = await supabaseBrowserClient
        .from("marketing_assets")
        .update({ visible_para_ia: !record.visible_para_ia })
        .eq("id", record.id);

      if (error) throw error;
      message.success(record.visible_para_ia ? "Ocultado para IA" : "Visible para IA");
      await cargarAssets();
    } catch (error) {
      console.error("Error actualizando visibilidad:", error);
      message.error("No se pudo actualizar la visibilidad para IA");
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
      setFileList([
        {
          uid: file.uid,
          name: file.name,
          size: file.size,
          type: file.type,
          originFileObj: file,
        },
      ]);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  const assetColumns = [
    {
      title: "Material",
      dataIndex: "titulo",
      key: "titulo",
      render: (_: unknown, record: MarketingAsset) => (
        <Space>
          {record.tipo_asset === "imagen" || record.tipo_asset === "flyer" ? (
            <FileImageOutlined style={{ fontSize: 20, color: "#ff7a45" }} />
          ) : record.tipo_asset === "pdf" ? (
            <FilePdfOutlined style={{ fontSize: 20, color: "#cf1322" }} />
          ) : (
            <FileOutlined style={{ fontSize: 20, color: "#595959" }} />
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
      width: 320,
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
      title: "Categoría",
      dataIndex: "categoria",
      key: "categoria",
      render: (categoria?: string) => categoria ? <Tag color="gold">{categoria}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: "Keywords",
      dataIndex: "keywords",
      key: "keywords",
      width: 220,
      render: (keywords?: string[]) =>
        keywords && keywords.length ? (
          <Space wrap>
            {keywords.map((keyword) => (
              <Tag key={keyword}>{keyword}</Tag>
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
      render: (estado: string) => <Tag color={estadoColors[estado] || "default"}>{estado}</Tag>,
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
      render: (_: unknown, record: MarketingAsset) => (
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
          <Tooltip title="Editar material">
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar este material?"
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

  return (
    <Space direction="vertical" size="large" style={{ width: "100%", padding: isMobile ? "16px" : "24px" }}>
      <Card
        style={{
          background: "linear-gradient(135deg, #1f2937 0%, #d97706 55%, #f59e0b 100%)",
          border: "none",
        }}
        styles={{ body: { padding: isMobile ? "16px" : "24px" } }}
      >
        <Space direction="vertical" size="small">
          <Space align="center" wrap>
            <ShopOutlined style={{ fontSize: 30, color: "#fff7ed" }} />
            <Title level={2} style={{ margin: 0, color: "#fff" }}>
              Centro de marketing
            </Title>
          </Space>
          <Text style={{ color: "#fff7ed", fontSize: 16 }}>
            Biblioteca comercial de La Cosmetikera para campañas, piezas promocionales y contexto de tienda.
          </Text>
        </Space>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Piezas cargadas" value={stats.totalAssets} prefix={<FileOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Visibles para IA" value={stats.visiblesIA} prefix={<RobotOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Categorías activas" value={stats.categorias} prefix={<TagsOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Marcas activas" value={stats.marcas} prefix={<ShopOutlined />} />
          </Card>
        </Col>
      </Row>

      <Skeleton active loading={initialLoading} paragraph={{ rows: isMobile ? 6 : 10 }}>
        <Tabs
          activeKey={activeTabKey}
          onChange={setActiveTabKey}
          destroyOnHidden
          items={[
            {
              key: "resumen",
              label: "Resumen comercial",
              children: (
                <Space direction="vertical" size="large" style={{ width: "100%" }}>
                  <Card
                    title="Contexto comercial para campañas"
                    extra={
                      <Space wrap>
                        <Button icon={<CopyOutlined />} onClick={() => navigator.clipboard.writeText(contextoComercial)}>
                          Copiar contexto
                        </Button>
                        <Button icon={<ReloadOutlined />} loading={loadingAssets || loadingArticulos} onClick={cargarTodo}>
                          Refrescar
                        </Button>
                      </Space>
                    }
                    styles={{ body: { padding: isMobile ? "16px" : "20px" } }}
                  >
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Alert
                        type="info"
                        showIcon
                        message="Enfoque de tienda"
                        description="Este módulo ya no intenta leer tablas del proyecto anterior. Ahora se alimenta del catálogo real de artículos y de la biblioteca de materiales promocionales."
                      />
                      <Text
                        code
                        style={{
                          whiteSpace: "pre-wrap",
                          width: "100%",
                          display: "block",
                          padding: "12px",
                          background: "#fffaf0",
                          borderRadius: 8,
                        }}
                      >
                        {contextoComercial}
                      </Text>
                    </Space>
                  </Card>

                  <Row gutter={[12, 12]}>
                    <Col xs={24} lg={8}>
                      <Card title="Ideas rápidas de campaña" styles={{ body: { padding: isMobile ? "12px" : "16px" } }}>
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                          {ideasCampana.map((idea) => (
                            <Alert key={idea} type="warning" showIcon message={idea} />
                          ))}
                        </Space>
                      </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Card title="Categorías con más referencias" styles={{ body: { padding: isMobile ? "12px" : "16px" } }}>
                        <Space wrap>
                          {categoriasSugeridas.length ? (
                            categoriasSugeridas.map((item) => (
                              <Tag key={item.nombre} color="orange">
                                {item.nombre} · {item.total}
                              </Tag>
                            ))
                          ) : (
                            <Text type="secondary">No hay categorías suficientes para sugerencias.</Text>
                          )}
                        </Space>
                      </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                      <Card title="Stock que conviene mover" styles={{ body: { padding: isMobile ? "12px" : "16px" } }}>
                        <Space direction="vertical" size="small" style={{ width: "100%" }}>
                          {stockBajo.length ? (
                            stockBajo.slice(0, 6).map((item) => (
                              <div key={item.id}>
                                <Text strong>{item.nombre}</Text>
                                <br />
                                <Text type="secondary">
                                  Stock {item.stock || 0} · mínimo {item.stock_minimo ?? 3}
                                </Text>
                              </div>
                            ))
                          ) : (
                            <Text type="secondary">No hay alertas de stock bajo.</Text>
                          )}
                        </Space>
                      </Card>
                    </Col>
                  </Row>

                  <Card title="Productos sugeridos para campañas" styles={{ body: { padding: 0 } }}>
                    <Table
                      rowKey="id"
                      size={isMobile ? "small" : "middle"}
                      loading={loadingArticulos}
                      dataSource={productosDestacados}
                      pagination={{ pageSize: isMobile ? 5 : 8 }}
                      scroll={{ x: 680 }}
                      locale={{ emptyText: "No hay productos disponibles en el catálogo." }}
                      columns={[
                        {
                          title: "Producto",
                          dataIndex: "nombre",
                          key: "nombre",
                          render: (_: unknown, record: ArticuloMarketing) => (
                            <Space direction="vertical" size={0}>
                              <Text strong>{record.nombre}</Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {[record.categoria, record.marca].filter(Boolean).join(" · ") || "Sin categoría"}
                              </Text>
                            </Space>
                          ),
                        },
                        {
                          title: "Precio",
                          dataIndex: "precio_venta",
                          key: "precio_venta",
                          render: (value?: number) => formatMoney(value),
                        },
                        {
                          title: "Stock",
                          dataIndex: "stock",
                          key: "stock",
                          render: (value?: number) => value ?? 0,
                        },
                      ]}
                    />
                  </Card>
                </Space>
              ),
            },
            {
              key: "materiales",
              label: "Materiales",
              children: (
                <Card
                  title="Biblioteca de materiales promocionales"
                  extra={
                    <Space wrap>
                      <Input.Search
                        placeholder="Buscar por título, descripción o keywords"
                        allowClear
                        onChange={(event) => setSearchTerm(event.target.value)}
                        style={{ width: isMobile ? 220 : 260 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Select
                        allowClear
                        placeholder="Tipo"
                        options={tipoAssetOptions}
                        onChange={(value) => setFilterTipo(value as string | undefined)}
                        style={{ width: 120 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Select
                        allowClear
                        placeholder="Categoría"
                        options={categoriaAssetOptions.map((categoria) => ({ value: categoria, label: categoria }))}
                        onChange={(value) => setFilterCategoria(value as string | undefined)}
                        style={{ width: 150 }}
                        size={isMobile ? "small" : "middle"}
                      />
                      <Switch
                        checked={soloIA}
                        onChange={setSoloIA}
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
                        Nuevo material
                      </Button>
                    </Space>
                  }
                  styles={{ body: { padding: isMobile ? "12px" : "20px" } }}
                >
                  <Table
                    columns={assetColumns}
                    dataSource={filteredAssets}
                    rowKey="id"
                    loading={loadingAssets}
                    size={isMobile ? "small" : "middle"}
                    scroll={{ x: 1080 }}
                    pagination={{ pageSize: isMobile ? 5 : 10 }}
                    locale={{ emptyText: "No hay materiales cargados todavía." }}
                  />
                </Card>
              ),
            },
          ]}
        />
      </Skeleton>

      <Modal
        title={editingAsset ? "Editar material promocional" : "Nuevo material promocional"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingAsset(null);
          setFileList([]);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editingAsset ? "Actualizar" : "Crear"}
        cancelText="Cancelar"
        width={isMobile ? 360 : 700}
        confirmLoading={uploading}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="titulo" label="Título" rules={[{ required: true, message: "Ingresa un título" }]}>
            <Input placeholder="Ej: Combo skincare de temporada" />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción interna (opcional)">
            <TextArea rows={2} placeholder="Uso interno del equipo de marketing o ventas" />
          </Form.Item>

          <Form.Item
            name="descripcion_ia"
            label="Descripción para IA"
            tooltip="Esto ayuda a que el sistema entienda cuándo usar este material en campañas o respuestas comerciales"
            rules={[{ required: true, message: "Describe el contenido para la IA" }]}
          >
            <TextArea
              rows={3}
              placeholder="Ej: Banner para WhatsApp con promoción de esmaltes semipermanentes, tono elegante, ideal para campañas de recompra o combos de manicure."
            />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Form.Item name="tipo_asset" label="Tipo de archivo" rules={[{ required: true, message: "Selecciona el tipo" }]}>
                <Select placeholder="Selecciona tipo" options={tipoAssetOptions} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categoria" label="Categoría comercial">
                <Select
                  placeholder="Selecciona categoría"
                  options={categoriaAssetOptions.map((categoria) => ({ value: categoria, label: categoria }))}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="keywords" label="Keywords separadas por coma">
            <Input placeholder="skincare, combo, promo, whatsapp, maquillaje" />
          </Form.Item>

          <Row gutter={[12, 12]}>
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
            <Col xs={24} md={12}>
              <Form.Item name="visible_para_ia" label="Visible para la IA" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Archivo" tooltip="Máximo 10MB">
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} block={isMobile}>
                {editingAsset ? "Cambiar archivo (opcional)" : "Seleccionar archivo"}
              </Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={previewVisible} footer={null} onCancel={() => setPreviewVisible(false)} width={800}>
        {previewUrl.endsWith(".pdf") ? (
          <iframe src={previewUrl} width="100%" height="600px" style={{ border: "none" }} />
        ) : previewUrl ? (
          <Image src={previewUrl} alt="Preview" style={{ width: "100%" }} />
        ) : (
          <Text type="secondary">No hay archivo para previsualizar.</Text>
        )}
      </Modal>
    </Space>
  );
}