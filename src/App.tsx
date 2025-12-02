import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Layout/Sidebar';
import CharactersPage from './pages/CharactersPage';
import CharacterSheet from './pages/CharacterSheet';
import CompendiumPage from './pages/CompendiumPage';
import NotesPage from './pages/NotesPage';
import DiceRoller from './pages/DiceRoller';
import ThemeEditor from './pages/ThemeEditor';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Settings from './components/Settings';

/**
 * Main App component that handles routing and layout
 * Sets up the application structure with sidebar navigation
 */
function AppContent() {
  const { theme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden">
        <Sidebar onSettingsClick={() => setShowSettings(true)} />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/characters" replace />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/character/:id" element={<CharacterSheet />} />
            <Route path="/compendium" element={<CompendiumPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/dice" element={<DiceRoller />} />
            <Route path="/settings/theme" element={<ThemeEditor />} />
          </Routes>
        </main>
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
      </div>
    </BrowserRouter>
  );
}

/**
 * App component wrapper that provides theme context to the entire application
 */
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
