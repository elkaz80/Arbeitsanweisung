import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url'; // Neue, robustere Methode

export default defineConfig({
  resolve: {
    alias: {
      // Erzwinge, dass 'three' immer auf das Hauptpaket im node_modules-Ordner verweist
      'three': fileURLToPath(new URL('./node_modules/three', import.meta.url))
    }
  }
});