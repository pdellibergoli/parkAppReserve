import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const API_ROUTES = {
  '/api/rpc': '/api/rpc.js',
  '/api/cron/assign': '/api/cron/assign.js',
}

// In sviluppo serve le funzioni di api/ dallo stesso server di Vite, come farà Vercel in produzione
const localApi = () => ({
  name: 'local-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const modulePath = API_ROUTES[req.url.split('?')[0]]
      if (!modulePath) return next()
      try {
        const { default: handler } = await server.ssrLoadModule(modulePath)
        await handler(req, res)
      } catch (err) {
        next(err)
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  // Anche le variabili senza prefisso VITE_ servono al server. Non finiscono nel bundle del browser.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    base: './',
    plugins: [react(), localApi()],
    build: {
      rollupOptions: {
        output: {
          // Le librerie cambiano di rado: separate dal codice dell'app restano nella cache del browser
          manualChunks(id) {
            if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
          },
        },
      },
    },
  }
})
