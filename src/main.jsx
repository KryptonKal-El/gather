import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './context/AuthContext.jsx';
import { ShoppingListProvider } from './context/ShoppingListContext.jsx';
import { RecipeProvider } from './context/RecipeContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { UndoProvider } from './context/UndoContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { App } from './App.jsx';
import { OAuthConsent } from './components/OAuthConsent.jsx';
import './index.css';

// The OAuth consent screen is served under the /app entry at /app/oauth/consent
// (see supabase config.toml). Render it standalone — without the app's data
// providers — so landing there never triggers a full app load.
const isOAuthConsent = window.location.pathname.replace(/\/+$/, '') === '/app/oauth/consent';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      {isOAuthConsent ? (
        <OAuthConsent />
      ) : (
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
      )}
    </ThemeProvider>
  </StrictMode>,
);
