import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',  // permite acesso de fora da máquina
    port: 5000,       // porta padrão para Replit
    allowedHosts: true // permite todos os hosts para funcionar no Replit
  }
})
