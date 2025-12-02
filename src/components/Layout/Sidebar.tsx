import { Link, useLocation } from 'react-router-dom';
import { 
  Users, BookOpen, FileText, Dices, Settings 
} from 'lucide-react';

interface SidebarProps {
  onSettingsClick: () => void;
}

/**
 * Sidebar navigation component providing navigation links and settings access
 * Displays active route with highlighting and includes responsive design
 */
export default function Sidebar({ onSettingsClick }: SidebarProps) {
  const location = useLocation();

  const navItems = [
    { path: '/characters', icon: Users, label: 'Characters' },
    { path: '/compendium', icon: BookOpen, label: 'Compendium' },
    { path: '/notes', icon: FileText, label: 'Notes' },
    { path: '/dice', icon: Dices, label: 'Dice Roller' },
  ];

  return (
    <aside className="w-48 bg-gray-200 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col">
      <div className="p-4">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          D&D Beyond
        </h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">Desktop</p>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || 
                          (item.path === '/characters' && location.pathname.startsWith('/character'));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button
        onClick={onSettingsClick}
        className="m-2 p-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
    </aside>
  );
}
