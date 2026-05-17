import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from '@svgr/rollup';

export default defineConfig({
  // exportType:'named' makes svgr expose the component as a named
  // `ReactComponent` export (CRA convention) instead of the default
  // export, matching how SVGs are imported across the codebase.
  plugins: [react(), svgr({ exportType: 'named' })],
  server: {
    proxy: {
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});