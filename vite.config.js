import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // Qualquer requisição para /api/* é encaminhada ao servidor Python.
            // O browser chama /api/gemini (mesma origem) → sem CORS.
            // REMINDER_API_TARGET aponta para outro servidor (ex.: um de teste na porta 8010).
            '/api': {
                target: process.env.REMINDER_API_TARGET || 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
})
