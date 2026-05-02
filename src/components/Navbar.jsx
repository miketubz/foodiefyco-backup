import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useTheme } from '../context/ThemeContext';

const THEMES = [
  { value: 'original', label: 'Original' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function Navbar({ cartCount, onCartClick }) {
  const isCartEmpty = cartCount === 0;
  const { theme, setTheme } = useTheme();

  const switcherBg =
    theme === 'dark'
      ? 'bg-gray-700/70'
      : theme === 'original'
        ? 'bg-teal-800/40'
        : 'bg-gray-100';

  const getButtonClass = (value) => {
    const isActive = theme === value;
    if (isActive) {
      if (theme === 'dark') return 'bg-gray-900 text-white shadow-sm';
      if (theme === 'original') return 'bg-teal-900 text-white shadow-sm';
      return 'bg-white text-gray-900 shadow-sm';
    }
    if (theme === 'dark') return 'text-gray-400 hover:text-gray-200';
    if (theme === 'original') return 'text-white/70 hover:text-white';
    return 'text-gray-500 hover:text-gray-700';
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-orange-200/60 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="FoodiefyCo"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-orange-100"
          />
          <div>
            <p className="text-lg font-bold tracking-tight text-gray-900">
              FoodiefyCo
            </p>
            <p className="text-xs text-gray-500">Fresh meals, delivered fast</p>
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Theme switcher */}
          <div className={`flex items-center rounded-full p-0.5 text-xs font-medium ${switcherBg}`}>
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
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

          {/* Cart button */}
          <button
            onClick={onCartClick}
            disabled={isCartEmpty}
            className="relative inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
              />
            </svg>
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-orange-600">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

