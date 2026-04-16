"use client";

import { ColorModeContext } from "@contexts/color-mode";
import type { RefineThemedLayoutHeaderProps } from "@refinedev/antd";
import { useGetIdentity, useLogout } from "@refinedev/core";
import {
  Layout as AntdLayout,
  Avatar,
  Space,
  Switch,
  theme,
  Typography,
  Button,
} from "antd";
import { BookOutlined, LogoutOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@hooks/useCurrentUser";
import React, { useContext } from "react";

const { Text } = Typography;
const { useToken } = theme;

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const { token } = useToken();
  const { data: user } = useGetIdentity<IUser>();
  const { mutate: logout } = useLogout();
  const colorMode = useContext(ColorModeContext);
  const mode = colorMode?.mode ?? "light";
  const setMode = colorMode?.setMode ?? (() => {});
  const router = useRouter();
  const { user: currentUser } = useCurrentUser();

  const headerStyles: React.CSSProperties = {
    backgroundColor: token.colorBgElevated,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: "0px 24px",
    height: "64px",
  };

  if (sticky) {
    headerStyles.position = "sticky";
    headerStyles.top = 0;
    headerStyles.zIndex = 1;
  }

  const getPortalRoute = () => {
    if (currentUser?.rol === "estudiante") {
      return "/portal-estudiante";
    } else if (currentUser?.rol === "profesor") {
      return "/mi-oficina";
    }
    return null;
  };

  const getPortalLabel = () => {
    if (currentUser?.rol === "estudiante") {
      return "Mi Portal";
    } else if (currentUser?.rol === "profesor") {
      return "Mi Oficina";
    }
    return null;
  };

  const portalRoute = getPortalRoute();
  const portalLabel = getPortalLabel();

  return (
    <AntdLayout.Header style={headerStyles}>
      <Space>
        {portalRoute && portalLabel && (
          <Button
            type="primary"
            icon={<BookOutlined />}
            onClick={() => router.push(portalRoute)}
          >
            {portalLabel}
          </Button>
        )}
        <Switch
          checkedChildren="🌛"
          unCheckedChildren="🔆"
          onChange={() => setMode(mode === "light" ? "dark" : "light")}
          defaultChecked={mode === "dark"}
        />
        {(user?.name || user?.avatar) && (
          <Space style={{ marginLeft: "8px" }} size="middle">
            {user?.name && <Text strong>{user.name}</Text>}
            {user?.avatar && <Avatar src={user?.avatar} alt={user?.name} />}
            <Button 
              danger 
              icon={<LogoutOutlined />} 
              onClick={() => logout()}
            >
              Logout
            </Button>
          </Space>
        )}
      </Space>
    </AntdLayout.Header>
  );
};
