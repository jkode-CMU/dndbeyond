import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';

export default function ThemeEditor() {
  const { setAccentColor } = useTheme();

  const [bgMain, setBgMain] = useState('#0f172a');
  const [bgSecondary, setBgSecondary] = useState('#0b1220');
  const [accentPrimary, setAccentPrimary] = useState('#6366f1');
  const [accentSecondary, setAccentSecondary] = useState('#06b6d4');
  const [textPrimary, setTextPrimary] = useState('#ffffff');
  const [textSecondary, setTextSecondary] = useState('#cbd5e1');
  const [textMuted, setTextMuted] = useState('#9ca3af');

  useEffect(() => {
    const keys: [string, (v: string) => void][] = [
      ['theme_bg_main', setBgMain],
      ['theme_bg_secondary', setBgSecondary],
      ['theme_accent_primary', setAccentPrimary],
      ['theme_accent_secondary', setAccentSecondary],
      ['theme_text_primary', setTextPrimary],
      ['theme_text_secondary', setTextSecondary],
      ['theme_text_muted', setTextMuted],
    ];

    keys.forEach(([k, setter]) => {
      const v = localStorage.getItem(k);
      if (v) {
        setter(v);
        document.documentElement.style.setProperty(`--${k.replace('theme_', '').replace(/_/g, '-')}`, v);
      }
    });
  }, []);

  const apply = (name: string, val: string, lsKey: string) => {
    // Always save the color, but only apply it to the DOM when custom theme is enabled
    localStorage.setItem(lsKey, val);
    const useCustom = localStorage.getItem('use_custom_theme') === 'true';
    if (useCustom) {
      document.documentElement.style.setProperty(name, val);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Theme Editor</h1>
          <p className="text-sm text-gray-600">Customize the main colors used across the app. Changes save immediately.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="px-3 py-2 bg-gray-200 rounded">Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">Main background</label>
          <input type="color" value={bgMain} onChange={(e) => { setBgMain(e.target.value); apply('--bg-main', e.target.value, 'theme_bg_main'); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Secondary background</label>
          <input type="color" value={bgSecondary} onChange={(e) => { setBgSecondary(e.target.value); apply('--bg-secondary', e.target.value, 'theme_bg_secondary'); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Accent primary</label>
          <input type="color" value={accentPrimary} onChange={(e) => { setAccentPrimary(e.target.value); apply('--accent-primary', e.target.value, 'theme_accent_primary'); setAccentColor(e.target.value); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Accent secondary</label>
          <input type="color" value={accentSecondary} onChange={(e) => { setAccentSecondary(e.target.value); apply('--accent-secondary', e.target.value, 'theme_accent_secondary'); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Primary text</label>
          <input type="color" value={textPrimary} onChange={(e) => { setTextPrimary(e.target.value); apply('--text-primary', e.target.value, 'theme_text_primary'); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Secondary text</label>
          <input type="color" value={textSecondary} onChange={(e) => { setTextSecondary(e.target.value); apply('--text-secondary', e.target.value, 'theme_text_secondary'); }} className="w-full h-10" />
        </div>

        <div>
          <label className="block text-sm mb-1">Muted text</label>
          <input type="color" value={textMuted} onChange={(e) => { setTextMuted(e.target.value); apply('--text-muted', e.target.value, 'theme_text_muted'); }} className="w-full h-10" />
        </div>

      </div>

      <div className="mt-6 flex gap-2">
        <button onClick={() => {
          const defaults = {
            '--bg-main': '#0f172a',
            '--bg-secondary': '#0b1220',
            '--accent-primary': '#6366f1',
            '--accent-secondary': '#06b6d4',
            '--text-primary': '#ffffff',
            '--text-secondary': '#cbd5e1',
            '--text-muted': '#9ca3af',
          };
          Object.entries(defaults).forEach(([k, v]) => {
            document.documentElement.style.setProperty(k, v as string);
            localStorage.setItem(`theme_${k.replace('--', '').replace(/-/g, '_')}`, v as string);
          });
          setBgMain('#0f172a');
          setBgSecondary('#0b1220');
          setAccentPrimary('#6366f1');
          setAccentSecondary('#06b6d4');
          setTextPrimary('#ffffff');
          setTextSecondary('#cbd5e1');
          setTextMuted('#9ca3af');
        }} className="px-3 py-2 bg-gray-200 rounded">Reset</button>

        <Link to="/" className="px-3 py-2 bg-primary text-white rounded">Done</Link>
      </div>
    </div>
  );
}
