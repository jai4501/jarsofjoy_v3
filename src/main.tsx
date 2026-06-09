import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter'
import '@fontsource/dancing-script'
import '@fontsource/playfair-display'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
