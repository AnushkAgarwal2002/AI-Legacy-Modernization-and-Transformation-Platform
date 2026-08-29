import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import App from './App'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <App />
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#17223A',
                color: '#F1F5F9',
                border: '1px solid #263550',
                fontSize: '13px',
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              },
              success: { iconTheme: { primary: '#34D399', secondary: '#17223A' } },
              error: { iconTheme: { primary: '#F87171', secondary: '#17223A' } },
            }}
          />
        </AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
