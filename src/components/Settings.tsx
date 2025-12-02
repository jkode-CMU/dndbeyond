import { useTheme } from '../contexts/ThemeContext';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface SettingsProps {
  onClose: () => void;
}

const accentColors = [
  { name: 'Indigo', value: 'indigo', class: 'bg-indigo-600' },
  { name: 'Blue', value: 'blue', class: 'bg-blue-600' },
  { name: 'Purple', value: 'purple', class: 'bg-purple-600' },
  { name: 'Green', value: 'green', class: 'bg-green-600' },
  { name: 'Red', value: 'red', class: 'bg-red-600' },
  { name: 'Orange', value: 'orange', class: 'bg-orange-600' },
];

/**
 * Settings modal component for changing theme and accent color
 * Shows quick theme controls and a link to the full Theme Editor page
 */
export default function Settings({ onClose }: SettingsProps) {
  const { theme, accentColor, font, setTheme, setAccentColor, setFont } = useTheme();
  const [useCustom, setUseCustom] = useState<boolean>(false);

  useEffect(() => {
    setUseCustom(localStorage.getItem('use_custom_theme') === 'true');
  }, []);

  const handleCustomToggle = (enabled: boolean) => {
    setUseCustom(enabled);
    localStorage.setItem('use_custom_theme', enabled ? 'true' : 'false');
    if (enabled) {
      const keys = ['theme_bg_main','theme_bg_secondary','theme_accent_primary','theme_accent_secondary','theme_text_primary','theme_text_secondary','theme_text_muted'];
      keys.forEach((k) => {
        const v = localStorage.getItem(k);
        if (v) document.documentElement.style.setProperty(`--${k.replace('theme_', '').replace(/_/g,'-')}`, v);
      });
    } else {
      ['--bg-main','--bg-secondary','--accent-primary','--accent-secondary','--text-primary','--text-secondary','--text-muted'].forEach((n) => {
        document.documentElement.style.removeProperty(n);
      });
    }
  };
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Theme Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="5" /></svg>
              )}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Theme</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleThemeChange('light')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'light'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  theme === 'dark'
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Accent Color</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {accentColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setAccentColor(color.value)}
                  className={`h-12 rounded-lg transition-transform hover:scale-105 ${
                    color.class
                  } ${accentColor === color.value ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : ''}`}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Custom theme toggle + link to full editor */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">Use a custom theme created in the Theme Editor page.</p>
              <label className="inline-flex items-center mt-2">
                <input
                  type="checkbox"
                  checked={useCustom}
                  onChange={(e) => handleCustomToggle(e.target.checked)}
                  className="form-checkbox h-4 w-4 text-primary"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable custom theme</span>
              </label>
            </div>
            <Link to="/settings/theme" onClick={onClose} className="text-sm px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200">Open full Theme Editor</Link>
          </div>

          {/* Font selection */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Font</h4>
            <div className="flex flex-col gap-2">
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="system">System UI</option>
                <option value="sans">Sans (Inter)</option>
                <option value="serif">Serif (Georgia)</option>
                <option value="rounded">Rounded (Rubik)</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
