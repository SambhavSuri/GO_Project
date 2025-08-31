'use client'
import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Guard WebXR polyfill to only run in browser
    if (typeof window !== 'undefined') {
      // Dynamically import only in browser
      (async () => {
        try {
          const { LookingGlassWebXRPolyfill, LookingGlassConfig } = await import("@lookingglass/webxr");
          const config = LookingGlassConfig;
          config.targetY = 0;
          config.targetZ = 0;
          config.targetDiam = 3;
          config.fovy = (40 * Math.PI) / 180;
          
          // Only initialize if not already initialized
          if (!(window as any).LookingGlassWebXRPolyfill) {
            new LookingGlassWebXRPolyfill();
            console.log('✅ Looking Glass WebXR Polyfill initialized in _app.tsx');
          } else {
            console.log('ℹ️ Looking Glass WebXR Polyfill already initialized');
          }
        } catch (error) {
          console.warn('⚠️ Failed to load Looking Glass WebXR polyfill:', error);
        }
      })();
    }
  }, [])
  return <Component {...pageProps} />;
}