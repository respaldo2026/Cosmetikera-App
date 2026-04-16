/**
 * Utilidades para trabajar con plantillas de WhatsApp
 */

export interface VariablesPlantilla {
  nombre?: string;
  nombre_academia?: string;
  redes_sociales?: string;
  telefono?: string;
  email?: string;
  programa_nombre?: string;
  programa_descripcion?: string;
  programa_duracion?: string;
  programa_clases?: string | number;
  programa_inscripcion?: string;
  programa_mensualidad?: string;
  [key: string]: string | number | undefined;
}

/**
 * Reemplaza las variables en una plantilla con los valores proporcionados
 * @param plantilla - Texto de la plantilla con variables entre llaves {variable}
 * @param variables - Objeto con los valores a reemplazar
 * @returns Plantilla procesada con las variables reemplazadas
 */
export const procesarPlantilla = (plantilla: string, variables: VariablesPlantilla): string => {
  let resultado = plantilla;

  // Reemplazar cada variable en la plantilla
  Object.entries(variables).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null) {
      const regex = new RegExp(`\\{${clave}\\}`, 'g');
      resultado = resultado.replace(regex, String(valor));
    }
  });

  // Limpiar variables no reemplazadas (opcional)
  resultado = resultado.replace(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, '');

  return resultado;
};

/**
 * Construye la cadena de redes sociales para la plantilla
 */
export const construirRedesSociales = (instagram?: string | null, facebook?: string | null, youtube?: string | null): string => {
  const redes = [];
  
  if (instagram) {
    redes.push(`📸 Instagram: ${instagram}`);
  }
  if (facebook) {
    redes.push(`👍 Facebook: ${facebook}`);
  }
  if (youtube) {
    redes.push(`▶️ YouTube: ${youtube}`);
  }

  return redes.length > 0 ? redes.join('\n') : '';
};
