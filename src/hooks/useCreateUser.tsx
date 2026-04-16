import { useState } from "react";
import { logger } from "@utils/logger";
import { App } from "antd";
import { useNavigation } from "@refinedev/core";


interface CreateUserValues {
  email: string;
  identificacion?: string;
}

interface CreateUserMetadata {
  [key: string]: unknown;
}

interface UseCreateUserProps {
  rol?: string;
  redirectResource?: string;
  successMessage?: string;
}

export const useCreateUser = (props: UseCreateUserProps = {}) => {
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const { list } = useNavigation();

  const createUser = async (values: CreateUserValues, metadata: CreateUserMetadata, specificRol?: string) => {
    setLoading(true);
    try {
      if (!values.email || !values.email.includes('@')) {
        throw new Error("El correo electrónico es obligatorio y debe ser válido");
      }

      const rolToUse = specificRol || props.rol;
      if (!rolToUse) throw new Error("Rol no especificado");

      // Limpiar identificación para usar como password (quitar puntos)
      const identificacionLimpia = values.identificacion ? String(values.identificacion).replace(/\./g, '') : '';
      const passwordTemporal = identificacionLimpia || `${rolToUse}123`;

      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: passwordTemporal,
          rol: rolToUse,
          user_metadata: metadata
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el usuario");
      }

      message.success({
        content: (
          <div>
            <div>{props.successMessage || "Usuario creado correctamente"}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Email: <strong>{values.email}</strong><br/>
              Contraseña temporal: <strong>{passwordTemporal}</strong>
            </div>
          </div>
        ),
        duration: 8
      });

      if (props.redirectResource) {
        list(props.redirectResource);
      }
      
      return true;

    } catch (error) {
      logger.error("Error creando usuario:", error);
      if (error instanceof Error) {
        message.error(error.message || "Error al crear el usuario");
      } else {
        message.error("Error al crear el usuario");
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading };
};