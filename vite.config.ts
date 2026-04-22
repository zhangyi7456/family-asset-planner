import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('echarts-for-react')) {
            return 'echarts-react'
          }

          if (id.includes('zrender')) {
            return 'zrender'
          }

          if (id.includes('echarts/core')) {
            return 'echarts-base'
          }

          if (id.includes('echarts/charts')) {
            return 'echarts-charts'
          }

          if (id.includes('echarts/components')) {
            return 'echarts-components'
          }

          if (id.includes('echarts/renderers')) {
            return 'echarts-renderers'
          }

          if (id.includes('echarts')) {
            return 'echarts-misc'
          }

          if (id.includes('react')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
