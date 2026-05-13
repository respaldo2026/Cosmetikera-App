"use client";

import React, { useMemo, useCallback, useEffect, useState } from "react";
import {
  Refine,
  useLogout,
  useMenu,
  useTranslate,
  useIsExistAuthentication,
  useLink,
  useWarnAboutChange,
  type TreeMenuItem,
} from "@refinedev/core";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import {
  ThemedLayout,
  ThemedTitle,
  useThemedLayoutContext,
  type RefineLayoutThemedTitleProps,
} from "@refinedev/antd";
import {
  ConfigProvider,
  App as AntdApp,
  Spin,
  Layout,
  Menu,
  Drawer,
  Button,
  Grid,
  theme,
} from "antd";
import type { MenuProps } from "antd";
import { usePathname, useRouter } from "next/navigation";
import {
  UserOutlined,
  BookOutlined,
  SettingOutlined,
  CalculatorOutlined,
  LogoutOutlined,
  UnorderedListOutlined,
  BarsOutlined,
  LeftOutlined,
  RightOutlined,
  NotificationOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  InboxOutlined,
  TruckOutlined,
  HistoryOutlined,
  GiftOutlined,
  TagsOutlined,
  ThunderboltOutlined,
  WalletOutlined, // reserved
  TeamOutlined,
  MessageOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import routerProvider from "@refinedev/nextjs-router";
import { dataProvider } from "@/providers/data-provider";
import { authProvider } from "@/providers/auth-provider/auth-provider.client";
import { QueryProvider } from "@/providers/query-provider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { RolesPermissionsProvider, useRolesPermissions } from "@/contexts/roles-permissions-context";
import { supabaseBrowserClient } from "@utils/supabase/client";
import { isMissingSupabaseRelationError } from "@/utils/supabase/optional";

const isDebugLogging = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDebugLogging) {
    console.log(...args);
  }
};

const allResources = [
  // ── VISTA GENERAL ────────────────────────────────────────────────
  {
    key: "dashboard",
    name: "dashboard",
    list: "/",
    meta: {
      label: "Vista rápida",
      icon: <ThunderboltOutlined />,
    },
  },
  // ── PUNTO DE VENTA ────────────────────────────────────────────────
  {
    key: "ventas",
    name: "ventas",
    list: "/ventas",
    meta: {
      label: "Ventas",
      icon: <ShoppingCartOutlined />,
    },
  },
  {
    key: "historial",
    name: "historial",
    list: "/historial",
    meta: {
      label: "Historial",
      icon: <HistoryOutlined />,
    },
  },
  // ── CATÁLOGO ──────────────────────────────────────────────────────
  {
    key: "articulos",
    name: "articulos",
    list: "/articulos",
    create: "/articulos/create",
    edit: "/articulos/edit/:id",
    show: "/articulos/show/:id",
    meta: {
      label: "Artículos",
      icon: <TagsOutlined />,
    },
  },
  // ── PROVEEDORES ───────────────────────────────────────────────────
  {
    key: "proveedores",
    name: "proveedores",
    list: "/proveedores",
    create: "/proveedores/create",
    edit: "/proveedores/edit/:id",
    meta: {
      label: "Proveedores",
      icon: <TruckOutlined />,
    },
  },
  {
    key: "compras",
    name: "compras",
    list: "/compras",
    create: "/compras/create",
    edit: "/compras/edit/:id",
    meta: {
      label: "Compras",
      icon: <InboxOutlined />,
    },
  },
  // ── CLIENTES ──────────────────────────────────────────────────────
  {
    key: "clientes",
    name: "clientes",
    list: "/clientes",
    meta: {
      label: "Clientes",
      icon: <TeamOutlined />,
    },
  },
  {
    key: "fidelizacion",
    name: "fidelizacion",
    list: "/fidelizacion",
    meta: {
      label: "Fidelización",
      icon: <GiftOutlined />,
    },
  },
  {
    key: "nomina",
    name: "nomina",
    list: "/nomina",
    create: "/nomina/create",
    meta: {
      label: "Nómina equipo",
      icon: <CalculatorOutlined />,
    },
  },
  // ── MARKETING ─────────────────────────────────────────────────────
  {
    key: "marketing-center",
    name: "marketing-center",
    list: "/marketing-center",
    meta: {
      label: "Marketing",
      icon: <NotificationOutlined />,
    },
  },
  // ── WHATSAPP AGENTE ───────────────────────────────────────────────
  {
    key: "whatsapp",
    name: "whatsapp",
    list: "/whatsapp",
    meta: {
      label: "WhatsApp Bot",
      icon: <MessageOutlined />,
    },
  },
  // ── SISTEMA ───────────────────────────────────────────────────────
  {
    key: "configuracion",
    name: "configuracion",
    list: "/configuracion",
    meta: {
      label: "Configuración",
      icon: <SettingOutlined />,
    },
  },
  {
    key: "configuracion-general",
    name: "configuracion-general",
    list: "/configuracion",
    meta: {
      label: "General",
      icon: <SettingOutlined />,
      parent: "configuracion",
    },
  },
  {
    key: "configuracion-club",
    name: "configuracion-club",
    list: "/configuracion/club",
    meta: {
      label: "Config. Club",
      icon: <GiftOutlined />,
      parent: "configuracion",
    },
  },
];

const LOGOUT_MENU_KEY = "__logout";

type CustomSiderProps = {
  Title?: React.FC<RefineLayoutThemedTitleProps>;
  meta?: Record<string, unknown>;
  fixed?: boolean;
  activeItemDisabled?: boolean;
  siderItemsAreCollapsed?: boolean;
};

type MenuClickEvent = Parameters<NonNullable<MenuProps["onClick"]>>[0];


const CustomSider: React.FC<CustomSiderProps> = ({
  Title: TitleFromProps,
  meta,
  fixed,
  activeItemDisabled = false,
  siderItemsAreCollapsed = true,
}) => {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const {
    siderCollapsed,
    setSiderCollapsed,
    mobileSiderOpen,
    setMobileSiderOpen,
  } = useThemedLayoutContext();

  const breakpoint = Grid.useBreakpoint();
  const isMobile = typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg;

  const direction = React.useContext(ConfigProvider.ConfigContext)?.direction;
  const isExistAuthentication = useIsExistAuthentication();
  const { mutate: mutateLogout } = useLogout();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const translate = useTranslate();
  const Link = useLink();
  const { menuItems, selectedKey, defaultOpenKeys } = useMenu({ meta });

  const RenderToTitle = TitleFromProps ?? ThemedTitle;

  const handleLogout = useCallback(() => {
    if (warnWhen) {
      const confirmLeave = window.confirm(
        translate(
          "warnWhenUnsavedChanges",
          "Are you sure you want to leave? You have unsaved changes.",
        ),
      );

      if (!confirmLeave) {
        return;
      }

      setWarnWhen(false);
    }

    mutateLogout();
  }, [mutateLogout, setWarnWhen, translate, warnWhen]);

  const buildMenuItems = useCallback(
    (tree: TreeMenuItem[]): MenuProps["items"] => {
      return tree
        .map((item) => {
          const { key, name, children, meta: itemMeta, list } = item;
          const parentName = itemMeta?.parent;
          const labelText = item.label ?? itemMeta?.label ?? name;
          const iconNode = itemMeta?.icon;
          const hasChildren = children.length > 0;
          const childItems = hasChildren ? buildMenuItems(children) : undefined;
          const isSelected = key === selectedKey;
          const disabled = activeItemDisabled && isSelected;
          const route = list;
          const isRoute = !(parentName !== undefined && children.length === 0);

          if (hasChildren) {
            if (!childItems || childItems.length === 0) {
              return null;
            }

            return {
              key,
              icon: iconNode ?? <UnorderedListOutlined />,
              label: labelText,
              children: childItems,
            } satisfies NonNullable<MenuProps["items"]>[number];
          }

          const labelNode = disabled || !route ? (
            <span>{labelText}</span>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 2 }}>
              <Link
                to={route ?? ""}
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {labelText}
              </Link>
              {!siderCollapsed && (
                <Tooltip title="Abrir en nueva ventana" placement="right">
                  <span
                    role="button"
                    aria-label={`Abrir ${labelText} en nueva ventana`}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      window.open(route, "_blank", "noopener,noreferrer");
                    }}
                    style={{
                      color: token.colorTextTertiary,
                      fontSize: 11,
                      padding: "2px 3px",
                      borderRadius: 4,
                      cursor: "pointer",
                      flexShrink: 0,
                      lineHeight: 1,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.color = token.colorPrimary;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLSpanElement).style.color = token.colorTextTertiary;
                    }}
                  >
                    <ExportOutlined />
                  </span>
                </Tooltip>
              )}
            </div>
          );

          return {
            key,
            icon: iconNode ?? (isRoute ? <UnorderedListOutlined /> : undefined),
            label: labelNode,
            disabled,
          } satisfies NonNullable<MenuProps["items"]>[number];
        })
        .filter(Boolean) as MenuProps["items"];
    },
    [Link, activeItemDisabled, selectedKey, siderCollapsed, token],
  );

  const menuStructure = useMemo(() => {
    const baseItems = buildMenuItems(menuItems) ?? [];

    if (!isExistAuthentication) {
      return baseItems;
    }

    return [
      ...baseItems,
      { type: "divider" as const },
      {
        key: LOGOUT_MENU_KEY,
        icon: <LogoutOutlined />,
        label: translate("buttons.logout", "Logout"),
      },
    ] as MenuProps["items"];
  }, [buildMenuItems, isExistAuthentication, menuItems, translate]);

  const defaultExpandMenuItems = useMemo(() => {
    if (siderItemsAreCollapsed) {
      return [] as string[];
    }

    return menuItems.map(({ key }) => key);
  }, [menuItems, siderItemsAreCollapsed]);

  useEffect(() => {
    const esRutaCaja = pathname?.startsWith("/ventas") || pathname?.startsWith("/caja");
    if (esRutaCaja && !siderCollapsed) {
      setSiderCollapsed(true);
    }
  }, [pathname, siderCollapsed, setSiderCollapsed]);

  const onMenuClick = useCallback(
    (info: MenuClickEvent) => {
      if (String(info.key) === LOGOUT_MENU_KEY) {
        handleLogout();
        return;
      }

      setMobileSiderOpen(false);
    },
    [handleLogout, setMobileSiderOpen],
  );

  const renderMenu = () => (
    <Menu
      items={menuStructure}
      selectedKeys={selectedKey ? [selectedKey] : []}
      defaultOpenKeys={[...defaultOpenKeys, ...defaultExpandMenuItems]}
      mode="inline"
      style={{
        paddingTop: "8px",
        border: "none",
        overflow: "auto",
        height: "calc(100% - 72px)",
      }}
      onClick={onMenuClick}
    />
  );

  const renderClosingIcons = () => {
    const iconProps = { style: { color: token.colorPrimary } };
    const OpenIcon = direction === "rtl" ? RightOutlined : LeftOutlined;
    const CollapsedIcon = direction === "rtl" ? LeftOutlined : RightOutlined;
    const IconComponent = siderCollapsed ? CollapsedIcon : OpenIcon;

    return <IconComponent {...iconProps} />;
  };

  const drawerSider = (
    <>
      <Drawer
        open={mobileSiderOpen}
        onClose={() => setMobileSiderOpen(false)}
        placement={direction === "rtl" ? "right" : "left"}
        closable={false}
        width={160}
        styles={{
          body: {
            padding: 0,
          },
        }}
        maskClosable
      >
        <Layout>
          <Layout.Sider
            style={{
              height: "100vh",
              backgroundColor: token.colorBgContainer,
              borderRight: `1px solid ${token.colorBgElevated}`,
            }}
          >
            <div
              style={{
                width: "200px",
                padding: "0 16px",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                height: "64px",
                backgroundColor: token.colorBgElevated,
              }}
            >
              <RenderToTitle collapsed={false} />
            </div>
            {renderMenu()}
          </Layout.Sider>
        </Layout>
      </Drawer>
      <Button
        style={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
        }}
        size="large"
        onClick={() => setMobileSiderOpen(true)}
        icon={<BarsOutlined />}
      />
    </>
  );

  if (isMobile) {
    return drawerSider;
  }

  const siderStyles: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBgElevated}`,
  };

  if (fixed) {
    siderStyles.position = "fixed";
    siderStyles.top = 0;
    siderStyles.height = "100vh";
    siderStyles.zIndex = 999;
  }

  return (
    <>
      {fixed && (
        <div
          style={{
            width: siderCollapsed ? "80px" : "200px",
            transition: "all 0.2s",
          }}
        />
      )}
      <Layout.Sider
        style={siderStyles}
        collapsible
        collapsed={siderCollapsed}
        onCollapse={(collapsed, type) => {
          if (type === "clickTrigger") {
            setSiderCollapsed(collapsed);
          }
        }}
        collapsedWidth={80}
        breakpoint="lg"
        trigger={
          <Button
            type="text"
            style={{
              borderRadius: 0,
              height: "100%",
              width: "100%",
              backgroundColor: token.colorBgElevated,
            }}
          >
            {renderClosingIcons()}
          </Button>
        }
      >
        <div
          style={{
            width: siderCollapsed ? "80px" : "200px",
            padding: siderCollapsed ? "0" : "0 16px",
            display: "flex",
            justifyContent: siderCollapsed ? "center" : "flex-start",
            alignItems: "center",
            height: "64px",
            backgroundColor: token.colorBgElevated,
            fontSize: "14px",
          }}
        >
          <RenderToTitle collapsed={siderCollapsed} />
        </div>
        {renderMenu()}
      </Layout.Sider>
    </>
  );
};

const FullScreenLoader = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      gap: 16,
    }}
  >
    <Spin size="large" />
    <div style={{ color: "#666", fontSize: 14 }}>Cargando…</div>
  </div>
);

const AppInner = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: userLoading } = useCurrentUser();
  const { permisos, loading: permisosLoading } = useRolesPermissions();
  const pathname = usePathname();
  const [brandingName, setBrandingName] = useState("La Cosmetikera");
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);

  const themeConfig = useMemo(
    () => ({
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: "#d81b87",
        colorSuccess: "#059669",
        colorWarning: "#D97706",
        colorError: "#DC2626",
        colorInfo: "#0284C7",
        colorTextBase: "#1F2937",
        colorText: "#1F2937",
        colorTextSecondary: "#374151",
        colorTextTertiary: "#4B5563",
        colorBgBase: "#F6F8FB",
        colorBgContainer: "#F0F3F8",
        colorBgElevated: "#FFFFFF",
        colorBgLayout: "#e1e6ee",
        colorBorder: "#c9d1de",
        colorBorderSecondary: "#d4dbe6",
        colorFillSecondary: "#e3e8f1",
        colorPrimaryBg: "#f8dbe9",
        controlOutline: "#d81b87",
        borderRadius: 8,
        fontSize: 14,
        // Compact global paddings
        paddingLG: 16,
        paddingMD: 12,
        paddingSM: 8,
        paddingXS: 4,
      },
      components: {
        Button: {
          controlHeight: 36,
          paddingInline: 12,
          fontWeight: 700,
        },
        Card: {
          borderRadiusLG: 12,
          padding: 14,
          paddingSM: 12,
          paddingLG: 16,
          bodyPadding: 14,
        },
        Tag: {
          borderRadiusSM: 6,
        },
        Table: {
          headerBg: "#F9FAFB",
          headerColor: "#374151",
          rowHoverBg: "#E9EEF6",
          borderColor: "#E5E7EB",
          headerPadding: 10,
          cellPaddingBlock: 8,
          cellPaddingInline: 10,
        },
        Layout: {
          bodyBg: "#e1e6ee",
          headerBg: "#FFFFFF",
          headerPadding: "0 16px",
        },
        Menu: {
          itemHeight: 38,
          itemPaddingInline: 12,
          itemMarginInline: 4,
        },
        Input: {},
        Select: {},
        Modal: {
          contentBg: "#FFFFFF",
          headerBg: "#FFFFFF",
          colorBgMask: "rgba(15, 23, 42, 0.55)",
          borderRadiusLG: 14,
          paddingMD: 18,
        },
        Drawer: {
          colorBgElevated: "#FFFFFF",
          colorBgMask: "rgba(15, 23, 42, 0.55)",
        },
      },
    }),
    [],
  );

  const i18nProvider = useMemo(() => {
    const messages: Record<string, string> = {
      "pages.login.title": "Accede a tu cuenta",
      "pages.login.subtitle": "Administración de tienda",
      "pages.login.signin": "Iniciar sesión",
      "pages.login.buttons.submit": "Entrar",
      "pages.login.buttons.forgotPassword": "¿Olvidaste tu contraseña?",
      "pages.login.buttons.remember": "Recordar sesión",
      "pages.login.fields.email": "Correo electrónico",
      "pages.login.fields.password": "Contraseña",
      "pages.login.fields.remember": "Recordarme",
      "pages.login.divider": "o",
      "pages.login.buttons.noAccount": "¿No tienes cuenta?",
      "pages.login.buttons.register": "Crear cuenta",
      "pages.login.buttons.haveAccount": "¿Ya tienes cuenta?",
    };

    return {
      translate: (key: string, defaultValue?: string) =>
        messages[key] ?? defaultValue ?? key,
      changeLocale: async () => {},
      getLocale: () => "es",
    };
  }, []);

  const normalizedRole = useMemo(() => {
    const rawRole = (user as any)?.rol ?? (user as any)?.role ?? "";
    let normalized = typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    // Mapear roles antiguos a los nuevos
    if (["admin", "director", "administrativo"].includes(normalized)) normalized = "administrador";
    if (["secretaria", "asesor"].includes(normalized)) normalized = "vendedor";
    if (["estudiante", "egresado"].includes(normalized)) normalized = "cliente";
    debugLog("[AppShell] User object:", user);
    debugLog("[AppShell] Raw role:", rawRole);
    debugLog("[AppShell] Normalized role:", normalized);
    return normalized;
  }, [user]);

  const isAuthRoute = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/club")
    );
  }, [pathname]);

  const roleNeedsPermissions = normalizedRole.length > 0 &&
    !['administrador'].includes(normalizedRole);

  const shouldUseLayout = !isAuthRoute && Boolean(user);

  const router = useRouter();

  useEffect(() => {
    const cargarBranding = async () => {
      const { data, error } = await supabaseBrowserClient
        .from("configuracion")
        .select("nombre_academia, logo_url")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (!isMissingSupabaseRelationError(error)) {
          console.error("Error cargando branding global:", error);
        }
        return;
      }

      if (data?.nombre_academia) setBrandingName(data.nombre_academia);
      if (data?.logo_url) setBrandingLogo(data.logo_url);
    };

    cargarBranding();
  }, []);

  React.useEffect(() => {
    if (!userLoading && !user && !isAuthRoute && !pathname?.startsWith("/club")) {
      router.replace("/login");
    }
  }, [user, userLoading, isAuthRoute, router, pathname]);

  const resources = useMemo(() => {
    if (userLoading || !user) {
      debugLog("[AppShell] Resources - No user or loading, returning []");
      return [];
    }

    debugLog("[AppShell] Resources - Building for role:", normalizedRole);

    if (normalizedRole === "administrador") {
      debugLog("[AppShell] Returning administrador resources");
      return allResources;
    }

    if (normalizedRole === "administrativo") {
      if (permisosLoading) {
        return [];
      }

      const userPermisos = permisos[normalizedRole] || {};
      const filteredResources = allResources.filter((resource) => {
        if (!resource.key) return false;
        if (resource.key === "dashboard") {
          return userPermisos.dashboard === true;
        }
        return userPermisos[resource.key] === true;
      });

      return filteredResources;
    }

    if (permisosLoading) {
      return [];
    }

    const userPermisos = permisos[normalizedRole] || {};
    const knownRoles = ["administrador", "marketing", "vendedor", "cliente", "administrativo"];

    // Si el rol no es conocido o no tiene permisos definidos, mostrar todo (fallback seguro)
    if (!normalizedRole || !knownRoles.includes(normalizedRole) || Object.keys(userPermisos).length === 0) {
      return allResources;
    }

    return allResources.filter((resource) => {
      if (!resource.key) return false;

      if (resource.key === "dashboard") {
        return userPermisos.dashboard === true;
      }

      return userPermisos[resource.key] === true;
    });
  }, [user, userLoading, normalizedRole, permisosLoading, permisos]);

  if (userLoading || (roleNeedsPermissions && permisosLoading)) {
    debugLog('[AppShell] Mostrando loader:', { userLoading, permisosLoading, roleNeedsPermissions });
    return <FullScreenLoader />;
  }
  
  debugLog('[AppShell] Renderizando app con usuario:', user?.id, 'rol:', normalizedRole);

  return (
    <RefineKbarProvider>
      <ConfigProvider
        theme={themeConfig}
      >
        <AntdApp>
          <Refine
            routerProvider={routerProvider}
            dataProvider={dataProvider}
            authProvider={authProvider}
            i18nProvider={i18nProvider}
            resources={resources}
            options={{
              syncWithLocation: true,
              warnWhenUnsavedChanges: true,
            }}
          >
            {!shouldUseLayout ? (
              <div style={{ minHeight: "100vh" }}>
                {children}
              </div>
            ) : (
              <ThemedLayout
                initialSiderCollapsed={false}
                Sider={CustomSider}
                Title={({ collapsed }) => (
                  <ThemedTitle
                    collapsed={collapsed}
                    text={brandingName}
                    icon={
                      brandingLogo ? (
                        <img
                          src={brandingLogo}
                          alt={brandingName}
                          style={{
                            width: 22,
                            height: 22,
                            objectFit: "contain",
                            borderRadius: 4,
                          }}
                        />
                      ) : (
                        <BookOutlined />
                      )
                    }
                  />
                )}
              >
                {children}
              </ThemedLayout>
            )}
            <RefineKbar />
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </RefineKbarProvider>
  );
};

export const AppShell = ({ children }: { children: React.ReactNode }) => (
  <QueryProvider>
    <RolesPermissionsProvider>
      <AppInner>{children}</AppInner>
    </RolesPermissionsProvider>
  </QueryProvider>
);
