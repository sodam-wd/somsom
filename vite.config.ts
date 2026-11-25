import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : GitHub Pages 저장소 하위 경로에서도 상대 경로로 리소스 로딩
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { sourcemap: false, outDir: 'dist' },
  server: { host: true },
  test: { environment: 'jsdom' },
});
