import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext.jsx';
import { ShoppingListProvider } from './context/ShoppingListContext.jsx';
import { RecipeProvider } from './context/RecipeContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { UndoProvider } from './context/UndoContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { App } from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ShoppingListProvider>
          <RecipeProvider>
            <UndoProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </UndoProvider>
          </RecipeProvider>
        </ShoppingListProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
