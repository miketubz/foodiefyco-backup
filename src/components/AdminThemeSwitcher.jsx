import { useTheme } from '../context/ThemeContext';

const THEMES = [
  { value: 'original', label: 'Original' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function AdminThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const switcherBg =
    theme === 'dark'
      ? 'bg-gray-700/70'
      : theme === 'original'
        ? 'bg-teal-800/30'
        : 'bg-gray-100 border border-gray-200';

  const getButtonClass = (value) => {
    const isActive = theme === value;
    if (isActive) {
      if (theme === 'dark') return 'bg-gray-900 text-white shadow-sm';
      if (theme === 'original') return 'bg-teal-900 text-white shadow-sm';
      return 'bg-white text-gray-900 shadow-sm';
    }
    if (theme === 'dark') return 'text-gray-400 hover:text-gray-200';
    if (theme === 'original') return 'text-teal-900/70 hover:text-teal-900';
    return 'text-gray-500 hover:text-gray-700';
  };

  return (
    <div className={`flex items-center rounded-full p-0.5 text-xs font-medium ${switcherBg}`}>
      {THEMES.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`rounded-full px-2.5 py-1 transition-all duration-200 ${getButtonClass(value)}`}
          aria-label={`${label} theme`}
        >
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">
            {value === 'original' ? 'O' : value === 'light' ? 'L' : 'D'}
          </span>
        </button>
      ))}
    </div>
  );
}
