import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get('title') || 'Quantitative Football Intelligence';
    const subtitle = searchParams.get('subtitle') || 'Ensembled Dixon-Coles & Poisson Models';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            backgroundColor: '#020617', // slate-950
            padding: '80px',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Top Row: Brand */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  backgroundColor: '#10b981', // emerald-500
                  marginRight: '12px',
                }}
              />
              <span
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: '#ffffff',
                  letterSpacing: '-0.05em',
                }}
              >
                HandicapLab
              </span>
            </div>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                padding: '6px 12px',
                borderRadius: '9999px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              Market Intelligence Terminal
            </span>
          </div>

          {/* Main Info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginTop: '40px',
            }}
          >
            <span
              style={{
                fontSize: '56px',
                fontWeight: 'extrabold',
                color: '#ffffff',
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                marginBottom: '16px',
                maxWidth: '900px',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: '22px',
                color: '#94a3b8', // slate-400
                fontWeight: 'normal',
                maxWidth: '800px',
              }}
            >
              {subtitle}
            </span>
          </div>

          {/* Footer Metrics */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '40px',
              width: '100%',
              borderTop: '1px solid #1e293b', // slate-800
              paddingTop: '32px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Distribution
              </span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', marginTop: '4px' }}>
                Dixon-Coles & Poisson
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Audit Metric
              </span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#f8fafc', marginTop: '4px' }}>
                Closing Line Value (CLV)
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Calibration
              </span>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981', marginTop: '4px' }}>
                Active (Platt Engine)
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.error(`OG image generation failed: ${e.message}`);
    return new Response(`Failed to generate image`, { status: 500 });
  }
}
