import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        background: 'linear-gradient(135deg, #111827 0%, #d81b87 55%, #f59e0b 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '80px',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        La Cosmetikera
      </div>

      <div
        style={{
          fontSize: '60px',
          color: '#f0d696',
          fontWeight: 'bold',
          marginBottom: '30px',
        }}
      >
        Admin + POS
      </div>

      <div
        style={{
          fontSize: '36px',
          color: '#ffffff',
          textAlign: 'center',
          maxWidth: '900px',
          lineHeight: '1.4',
        }}
      >
        Belleza, ventas y fidelizacion de clientes
      </div>

      <div
        style={{
          fontSize: '24px',
          color: '#f0d696',
          marginTop: '60px',
          borderTop: '2px solid rgba(255,255,255,0.3)',
          paddingTop: '30px',
        }}
      >
        ✓ Punto de venta • Clientes frecuentes • Gestion diaria
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  );
}
