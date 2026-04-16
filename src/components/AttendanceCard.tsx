import React, { useEffect, useState } from 'react';
import { Card, Progress, Button, Alert, Spin, Tag } from 'antd';
import { FilePdfOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabaseBrowserClient } from '@/utils/supabase/client'; // Ajusta esta ruta a tu configuración real
import { logger } from '@utils/logger';

// Definición de tipos para los datos que vienen de la base de datos
interface AttendanceStats {
  total_classes: number;
  attended_classes: number;
  percentage: number;
  min_required: number;
  is_blocked: boolean;
  status_label: string;
}

interface AttendanceCardProps {
  studentId: string;
  courseId: string;
  onDownloadCertificate: () => void; // Función que se ejecuta si todo está OK
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({ 
  studentId, 
  courseId, 
  onDownloadCertificate 
}) => {
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos al montar el componente
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const supabase = supabaseBrowserClient; // Inicializa tu cliente

        // Llamada a la función RPC (Remote Procedure Call) que creamos en SQL
        const { data, error } = await supabase
          .rpc('get_student_attendance_stats', {
            p_student_id: studentId,
            p_course_id: courseId,
          });

        if (error) throw error;
        setStats(data as AttendanceStats);

      } catch (err) {
        logger.error('Error fetching attendance:', err);
        setError('No se pudo cargar la información de asistencia.');
      } finally {
        setLoading(false);
      }
    };

    if (studentId && courseId) {
      fetchStats();
    }
  }, [studentId, courseId]);

  // Renderizado de estado de carga o error
  if (loading) return <Card><Spin tip="Calculando asistencia..." /></Card>;
  if (error) return <Alert message="Error" description={error} type="error" showIcon />;
  if (!stats) return null;

  // Lógica de colores según el estado
  const statusColor = stats.is_blocked ? '#ff4d4f' : '#52c41a'; // Rojo o Verde
  const strokeColor = stats.is_blocked ? '#ff4d4f' : '#1890ff'; // Rojo o Azul estándar

  return (
    <Card 
      title={
        <div className="flex justify-between items-center">
          <span>📊 Rendimiento de Asistencia</span>
          <Tag color={stats.is_blocked ? 'error' : 'success'}>
            {stats.status_label}
          </Tag>
        </div>
      }
      className="shadow-md rounded-lg"
    >
      <div className="flex flex-col gap-4">
        
        {/* Sección de Barra de Progreso */}
        <div className="text-center">
          <Progress 
            type="dashboard" 
            percent={stats.percentage} 
            strokeColor={strokeColor}
            format={(percent) => (
              <div className="flex flex-col">
                <span className="text-2xl font-bold">{percent}%</span>
                <span className="text-xs text-gray-500">Asistencia</span>
              </div>
            )}
          />
          <div className="mt-2 text-gray-600">
            Has asistido a <b>{stats.attended_classes}</b> de <b>{stats.total_classes}</b> clases.
            <br />
            <span className="text-xs text-gray-400">
              Mínimo requerido: {stats.min_required}%
            </span>
          </div>
        </div>

        {/* Sección de Alertas y Acciones */}
        {stats.is_blocked ? (
          <Alert
            message="Certificado Bloqueado"
            description={`Tu asistencia (${stats.percentage}%) está por debajo del mínimo requerido (${stats.min_required}%). No puedes generar el certificado aún.`}
            type="error"
            showIcon
            icon={<WarningOutlined />}
          />
        ) : (
          <Alert 
            message="¡Todo en orden!" 
            description="Cumples con el requisito de asistencia." 
            type="success" 
            showIcon
            icon={<CheckCircleOutlined />}
            className="mb-2"
          />
        )}

        {/* Botón de Acción Principal */}
        <Button 
          type="primary" 
          size="large"
          icon={<FilePdfOutlined />}
          disabled={stats.is_blocked} // Bloqueo real en el botón
          onClick={onDownloadCertificate}
          className={`w-full ${stats.is_blocked ? 'opacity-50' : 'bg-blue-600'}`}
        >
          {stats.is_blocked ? 'Requisito no cumplido' : 'Descargar Certificado'}
        </Button>

      </div>
    </Card>
  );
};

export default AttendanceCard;