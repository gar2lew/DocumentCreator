import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-bg-tertiary transition-colors w-[calc(100%-16px)]"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-4 h-4 shrink-0" />
      ) : (
        <Sun className="w-4 h-4 shrink-0" />
      )}
      <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
    </button>
  );
}
