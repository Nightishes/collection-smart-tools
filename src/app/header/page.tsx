'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import styles from './header.module.css';

const Header = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, isAdmin } = useAuth();

  const isActiveLink = (path: string) => {
    return pathname === path ? styles.activeLink : '';
  };

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        Smart Tools
      </Link>
      <nav className={styles.nav}>
        <Link 
          href="/" 
          className={`${styles.navLink} ${isActiveLink('/')}`}
        >
          Home
        </Link>
        <Link 
          href="/pdf-modifier" 
          className={`${styles.navLink} ${isActiveLink('/pdf-modifier')}`}
        >
          PDF Modifier
        </Link>
        <Link 
          href="/text-converter" 
          className={`${styles.navLink} ${isActiveLink('/text-converter')}`}
        >
          Convert Text
        </Link>
        {isAuthenticated && (
          <Link 
            href="/login" 
            className={`${styles.navLink} ${isActiveLink('/login')}`}
          >
            {isAdmin ? '👤 Admin' : '👤 User'}
          </Link>
        )}
        <button 
          onClick={toggleTheme}
          className={styles.themeToggle}
          aria-label="Toggle theme"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </nav>
    </header>
  );
};

export default Header;
