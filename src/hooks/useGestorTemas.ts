import { useState } from "react";
import { Form } from "antd";
import { supabaseBrowserClient } from "@utils/supabase/client";

export const useGestorTemas = (
  cursoId: string | null, 
  onTemasActualizados: (temas: any[]) => void,
  messageApi: any
) => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const guardarTema = async () => {
    if (!cursoId) return;
    
    setLoading(true);
    try {
      const values = await form.validateFields();
      const { error } = await supabaseBrowserClient.from("temas_curso").insert({
        ...values,
        curso_id: cursoId
      });

      if (error) throw error;

      messageApi.success("Tema agregado");
      form.resetFields();
      setVisible(false);
      
      const { data } = await supabaseBrowserClient
        .from("temas_curso")
        .select("*")
        .eq("curso_id", cursoId)
        .order("orden");
        
      onTemasActualizados(data || []);

    } catch (error: any) {
      messageApi.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    form,
    visible,
    setVisible,
    loading,
    guardarTema
  };
};