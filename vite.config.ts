import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// PAGES=1 : build pour GitHub Pages (servi sous /idiger-risk-model-platform/).
export default defineConfig({base:process.env.PAGES?'/idiger-risk-model-platform/':'/',plugins:[react()],server:{host:'127.0.0.1',port:5180,strictPort:true},build:{rollupOptions:{output:{manualChunks:{map:['maplibre-gl'],three:['three'],react:['react','react-dom']}}}}});
