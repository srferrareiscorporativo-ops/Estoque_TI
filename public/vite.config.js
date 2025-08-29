import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,  // permite acesso de fora da máquina
    port: 80,    // troca porta (precisa rodar como admin)
    allowedHosts: [
      'estoqueti.agricopel.com.br' // libera seu domínio
    ]
  }
})
