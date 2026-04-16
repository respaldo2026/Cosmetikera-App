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
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
  SettingOutlined,
  CalculatorOutlined,
  CalendarOutlined,
  CustomerServiceOutlined,
  HomeOutlined,
  UsergroupAddOutlined,
  SolutionOutlined,
  LogoutOutlined,
  UnorderedListOutlined,
  BarsOutlined,
  LeftOutlined,
  RightOutlined,
  MoonOutlined,
  SunOutlined,
  NotificationOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import routerProvider from "@refinedev/nextjs-router";
import { dataProvider } from "@/providers/data-provider";
import { authProvider } from "@/providers/auth-provider/auth-provider.client";
import { QueryProvider } from "@/providers/query-provider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { RolesPermissionsProvider, useRolesPermissions } from "@/contexts/roles-permissions-context";
import { ColorModeContextProvider, useColorMode } from "@/contexts/color-mode";
import { supabaseBrowserClient } from "@utils/supabase/client";

const allResources = [
  {
    key: "dashboard",
    name: "dashboard",
    list: "/",
    meta: {
      label: "Dashboard",
      icon: <DashboardOutlined />,
    },
  },
  {
    key: "estudiantes",
    name: "perfiles",
    list: "/estudiantes",
    create: "/estudiantes/create",
    edit: "/estudiantes/edit/:id",
    show: "/estudiantes/show/:id",
    meta: {
      label: "Estudiantes",
      icon: <UserOutlined />,
    },
  },
  {
    key: "profesores",
    name: "profesores",
    list: "/profesores",
    create: "/profesores/create",
    edit: "/profesores/edit/:id",
    show: "/profesores/show/:id",
    meta: {
      label: "Profesores",
      icon: <SolutionOutlined />,
    },
  },
  {
    key: "cursos",
    name: "programas",
    list: "/programas",
    meta: {
      label: "Programas",
      icon: <BookOutlined />,
    },
  },
  {
    key: "cursos",
    name: "cursos",
    list: "/cursos",
    create: "/cursos/create",
    edit: "/cursos/edit/:id",
    show: "/cursos/show/:id",
    meta: {
      label: "Grupos",
      icon: <UsergroupAddOutlined />,
    },
  },
  {
    key: "leads",
    name: "leads",
    list: "/leads",
    meta: {
      label: "Leads",
      icon: <CustomerServiceOutlined />,
    },
  },
  {
    key: "marketing-center",
    name: "marketing-center",
    list: "/marketing-center",
    meta: {
      label: "Marketing Center",
      icon: <NotificationOutlined />,
    },
  },
  {
    key: "planificador",
    name: "planificador",
    list: "/planificador",
    meta: {
      label: "Planificador",
      icon: <CalendarOutlined />,
    },
  },
  {
    key: "catalogo",
    name: "catalogo",
    list: "/catalogo",
    meta: {
      label: "Catálogo cursos",
      icon: <BarsOutlined />,
    },
  },
  {
    key: "matriculas",
    name: "matriculas",
    list: "/matriculas",
    create: "/matriculas/create",
    edit: "/matriculas/edit/:id",
    show: "/matriculas/show/:id",
    meta: {
      label: "Matrículas",
      icon: <FileTextOutlined />,
    },
  },
  {
    key: "nomina",
    name: "nomina",
    list: "/nomina",
    create: "/nomina/create",
    meta: {
      label: "Nómina",
      icon: <CalculatorOutlined />,
    },
  },
  {
    key: "caja",
    name: "caja",
    list: "/caja",
    meta: {
      label: "Caja / POS",
      icon: <ShoppingCartOutlined />,
    },
  },
  {
    key: "tesoreria",
    name: "tesoreria",
    list: "/tesoreria",
    create: "/tesoreria/create",
    meta: {
      label: "Tesorería",
      icon: <DollarCircleOutlined />,
    },
  },
  {
    key: "rentabilidad",
    name: "rentabilidad",
    list: "/rentabilidad",
    meta: {
      label: "Análisis de Rentabilidad",
      icon: <CalculatorOutlined />,
    },
  },
  {
    key: "conversaciones",
    name: "conversaciones",
    list: "/conversaciones",
    meta: {
      label: "Conversaciones IA",
      icon: <UnorderedListOutlined />,
    },
  },
  {
    key: "configuracion",
    name: "configuracion",
    list: "/configuracion",
    meta: {
      label: "Configuración",
      icon: <SettingOutlined />,
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
            <Link
              to={route ?? ""}
              style={{
                display: "inline-block",
                width: "100%",
              }}
            >
              {labelText}
            </Link>
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
    [Link, activeItemDisabled, selectedKey],
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

const ThemeToggleButton = () => {
  const { mode, toggle } = useColorMode();
  const isDarkMode = mode === "dark";

  return (
    <Button
      type="text"
      shape="circle"
      size="small"
      onClick={toggle}
      icon={isDarkMode ? <SunOutlined /> : <MoonOutlined />}
      style={{
        position: "fixed",
        bottom: 16,
        left: 14,
        zIndex: 950,
        background: "transparent",
        boxShadow: "none",
        border: `1px solid ${isDarkMode ? "#1f2937" : "#e5e7eb"}`,
        color: isDarkMode ? "#e5e7eb" : "#111827",
      }}
      aria-label={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {null}
    </Button>
  );
};

const AppInner = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: userLoading } = useCurrentUser();
  const { permisos, loading: permisosLoading } = useRolesPermissions();
  const { mode } = useColorMode();
  const pathname = usePathname();
  const [brandingName, setBrandingName] = useState("Crystal App");
  const [brandingLogo, setBrandingLogo] = useState<string | null>(null);

  const isDarkMode = mode === "dark";

  const themeConfig = useMemo(
    () => ({
      algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      token: {
        colorPrimary: "#d81b87",
        colorSuccess: "#059669",
        colorWarning: "#D97706",
        colorError: "#DC2626",
        colorInfo: "#0284C7",
        colorTextBase: isDarkMode ? "#F8FAFC" : "#1F2937",
        colorText: isDarkMode ? "#E2E8F0" : "#1F2937",
        colorTextSecondary: isDarkMode ? "#CBD5E1" : "#374151",
        colorTextTertiary: isDarkMode ? "#94A3B8" : "#4B5563",
        colorBgBase: isDarkMode ? "#0A1020" : "#F6F8FB",
        colorBgContainer: isDarkMode ? "#0C1426" : "#F0F3F8",
        colorBgElevated: isDarkMode ? "#111827" : "#FFFFFF",
        colorBgLayout: isDarkMode ? "#090f1d" : "#e1e6ee",
        colorBorder: isDarkMode ? "#3b4a63" : "#c9d1de",
        colorBorderSecondary: isDarkMode ? "#263347" : "#d4dbe6",
        colorFillSecondary: isDarkMode ? "#1d293b" : "#e3e8f1",
        colorPrimaryBg: isDarkMode ? "#4d1132" : "#f8dbe9",
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
          colorBgContainer: isDarkMode ? "#121a2d" : undefined,
          headerBg: isDarkMode ? "#0f182a" : undefined,
          boxShadow: isDarkMode ? "0 12px 32px rgba(0,0,0,0.35)" : undefined,
        },
        Tag: {
          borderRadiusSM: 6,
        },
        Table: {
          headerBg: isDarkMode ? "#0F172A" : "#F9FAFB",
          headerColor: isDarkMode ? "#E5E7EB" : "#374151",
          rowHoverBg: isDarkMode ? "#0B1220" : "#E9EEF6",
          borderColor: isDarkMode ? "#233044" : "#E5E7EB",
          headerPadding: 10,
          cellPaddingBlock: 8,
          cellPaddingInline: 10,
        },
        Layout: {
          bodyBg: isDarkMode ? "#090f1d" : "#e1e6ee",
          headerBg: isDarkMode ? "#0F172A" : "#FFFFFF",
          siderBg: isDarkMode ? "#0F172A" : undefined,
          headerPadding: "0 16px",
        },
        Menu: {
          itemColor: isDarkMode ? "#E5E7EB" : undefined,
          itemSelectedColor: isDarkMode ? "#F3F4F6" : undefined,
          itemSelectedBg: isDarkMode ? "#1F2937" : undefined,
          itemHoverBg: isDarkMode ? "#111827" : undefined,
          itemHeight: 38,
          itemPaddingInline: 12,
          itemMarginInline: 4,
        },
        Input: {
          colorBgContainer: isDarkMode ? "#111a2d" : undefined,
          colorTextPlaceholder: isDarkMode ? "#cbd5e1" : undefined,
          activeBorderColor: isDarkMode ? "#A855F7" : undefined,
          hoverBorderColor: isDarkMode ? "#c084fc" : undefined,
          colorBorder: isDarkMode ? "#334155" : undefined,
        },
        Select: {
          colorBgContainer: isDarkMode ? "#111a2d" : undefined,
          colorTextPlaceholder: isDarkMode ? "#cbd5e1" : undefined,
          optionSelectedBg: isDarkMode ? "#1F2937" : undefined,
          colorBorder: isDarkMode ? "#334155" : undefined,
        },
        Modal: {
          contentBg: isDarkMode ? "#111827" : "#FFFFFF",
          headerBg: isDarkMode ? "#111827" : "#FFFFFF",
          colorBgMask: "rgba(15, 23, 42, 0.55)",
          borderRadiusLG: 14,
          paddingMD: 18,
        },
        Drawer: {
          colorBgElevated: isDarkMode ? "#0F172A" : "#FFFFFF",
          colorBgMask: "rgba(15, 23, 42, 0.55)",
        },
      },
    }),
    [isDarkMode],
  );

  const i18nProvider = useMemo(() => {
    const messages: Record<string, string> = {
      "pages.login.title": "Accede a tu cuenta",
      "pages.login.subtitle": "Plataforma Académica",
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
    const normalized = typeof rawRole === "string" ? rawRole.toLowerCase() : "";
    console.log("[AppShell] User object:", user);
    console.log("[AppShell] Raw role:", rawRole);
    console.log("[AppShell] Normalized role:", normalized);
    return normalized;
  }, [user]);

  const isAuthRoute = useMemo(() => {
    if (!pathname) return false;
    return (
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/auth")
    );
  }, [pathname]);

  const roleNeedsPermissions = normalizedRole.length > 0 &&
    !["admin", "director", "profesor", "estudiante"].includes(normalizedRole);

  const shouldUseLayout = !isAuthRoute && Boolean(user);

  const router = useRouter();

  useEffect(() => {
    const cargarBranding = async () => {
      const { data } = await supabaseBrowserClient
        .from("configuracion")
        .select("nombre_academia, logo_url")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (data?.nombre_academia) setBrandingName(data.nombre_academia);
      if (data?.logo_url) setBrandingLogo(data.logo_url);
    };

    cargarBranding();
  }, []);

  React.useEffect(() => {
    if (!userLoading && !user && !isAuthRoute) {
      router.replace("/login");
    }
  }, [user, userLoading, isAuthRoute, router]);

  const resources = useMemo(() => {
    if (userLoading || !user) {
      console.log("[AppShell] Resources - No user or loading, returning []");
      return [];
    }

    console.log("[AppShell] Resources - Building for role:", normalizedRole);

    if (normalizedRole === "admin" || normalizedRole === "director") {
      console.log("[AppShell] Returning admin/director resources");
      return allResources;
    }

    if (normalizedRole === "profesor") {
      console.log("[AppShell] Returning profesor resources");
      return [
        {
          name: "mi-oficina",
          list: "/mi-oficina",
          meta: {
            label: "Mi Oficina",
            icon: <HomeOutlined />,
          },
        },
      ];
    }

    if (normalizedRole === "estudiante") {
      console.log("[AppShell] Returning estudiante resources");
      return [
        {
          name: "portal-estudiante",
          list: "/portal-estudiante",
          meta: {
            label: "Mi Portal",
            icon: <BookOutlined />,
          },
        },
      ];
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

      // Agregar dashboard de secretaria al inicio
      return [
        {
          name: "dashboard-secretaria",
          list: "/dashboard/secretaria",
          meta: {
            label: "Dashboard",
            icon: <DashboardOutlined />,
          },
        },
        ...filteredResources.filter(r => r.key !== "dashboard"),
      ];
    }

    if (permisosLoading) {
      return [];
    }

    const userPermisos = permisos[normalizedRole] || {};

    return allResources.filter((resource) => {
      if (!resource.key) return false;

      if (resource.key === "dashboard") {
        return userPermisos.dashboard === true;
      }

      return userPermisos[resource.key] === true;
    });
  }, [user, userLoading, normalizedRole, permisosLoading, permisos]);

  if (userLoading || (roleNeedsPermissions && permisosLoading)) {
    console.log('[AppShell] Mostrando loader:', { userLoading, permisosLoading, roleNeedsPermissions });
    return <FullScreenLoader />;
  }
  
  console.log('[AppShell] Renderizando app con usuario:', user?.id, 'rol:', normalizedRole);

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
                <ThemeToggleButton />
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
      <ColorModeContextProvider defaultMode="dark">
        <AppInner>{children}</AppInner>
      </ColorModeContextProvider>
    </RolesPermissionsProvider>
  </QueryProvider>
);
