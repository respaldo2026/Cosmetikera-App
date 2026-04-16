import React, { useEffect, useState, useCallback } from 'react';
import { Card, Statistic, Progress, Tag, Typography, Alert, Space } from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  WarningOutlined,
  TrophyOutlined 
} from '@ant-design/icons';
import { supabaseBrowserClient } from '@utils/supabase/client';
import { logger } from '@utils/logger';

const { Text } = Typography;

interface AttendanceCardProps {
  matriculaId: number;
  cursoId?: number;
  showDetails?: boolean;
  minimoRequerido?: number;
}

interface AttendanceStats {
  totalClases: number;
  presentes: number;
  ausentes: number;
  porcentaje: number;
  cumple: boolean;
  tieneDatos: boolean;
}

export const AttendanceCardNew: React.FC<AttendanceCardProps> = ({
  matriculaId,
  cursoId,
  showDetails = true,
  minimoRequerido = 80
}) => {
  const [stats, setStats] = useState<AttendanceStats>({
    totalClases: 0,
    presentes: 0,
    ausentes: 0,
    porcentaje: 0,
    cumple: false,
    tieneDatos: false
  });
  const [loading, setLoading] = useState(true);

  const calcularAsistencia = useCallback(async () => {
    setLoading(true);
    try {
      const { data: asistencias } = await supabaseBrowserClient
        .from('asistencias')
        .select('estado')
        .eq('matricula_id', matriculaId);

      if (asistencias && asistencias.length > 0) {
        const totalClases = asistencias.length;
        const presentes = asistencias.filter(a => a.estado === 'presente').length;
        const ausentes = totalClases - presentes;
        const porcentaje = Math.round((presentes / totalClases) * 100);
        const cumple = porcentaje >= minimoRequerido;

        setStats({
          totalClases,
          presentes,
          ausentes,
          porcentaje,
          cumple,
          tieneDatos: true
        });
      }
    } catch (error) {
      logger.error('Error calculando asistencia:', error);
    } finally {
      setLoading(false);
    }
  }, [matriculaId, minimoRequerido]);

  useEffect(() => {
    calcularAsistencia();
  }, [calcularAsistencia]);

  if (!stats.tieneDatos && !loading) {
    return (
      <Card size="small">
        <Text type="secondary">Sin datos de asistencia</Text>
      </Card>
    );
  }

  return (
    <Card 
      size="small" 
      loading={loading}
      style={{ 
        borderColor: stats.cumple ? '#52c41a' : '#ff4d4f',
        borderWidth: 2
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* Porcentaje Principal */}
        <div style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={stats.porcentaje}
            size={80}
            status={stats.cumple ? 'success' : 'exception'}
            format={(percent) => (
              <div>
                <div style={{ fontSize: 20, fontWeight: 'bold' }}>{percent}%</div>
                <div style={{ fontSize: 10 }}>Asistencia</div>
              </div>
            )}
          />
        </div>

        {/* Estado */}
        <div style={{ textAlign: 'center' }}>
          {stats.cumple ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              CUMPLE REQUISITO
            </Tag>
          ) : (
            <Tag color="error" icon={<WarningOutlined />}>
              EN RIESGO
            </Tag>
          )}
        </div>

        {/* Detalles */}
        {showDetails && (
          <div style={{ fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text>Total clases:</Text>
              <Text strong>{stats.totalClases}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="success">Presentes:</Text>
              <Text strong type="success">{stats.presentes}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text type="danger">Ausentes:</Text>
              <Text strong type="danger">{stats.ausentes}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text>Mínimo requerido:</Text>
              <Text strong>{minimoRequerido}%</Text>
            </div>
          </div>
        )}

        {/* Alerta si no cumple */}
        {!stats.cumple && (
          <Alert
            message="Certificado bloqueado"
            description={`Debe alcanzar al menos ${minimoRequerido}% de asistencia para certificarse.`}
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginTop: 8 }}
          />
        )}

        {/* Mensaje de éxito */}
        {stats.cumple && stats.porcentaje >= 90 && (
          <Alert
            message="¡Excelente asistencia!"
            type="success"
            showIcon
            icon={<TrophyOutlined />}
            style={{ marginTop: 8 }}
          />
        )}
      </Space>
    </Card>
  );
};
