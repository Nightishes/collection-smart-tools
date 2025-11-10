'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../context/ThemeContext';
import styles from './header.module.css';

const Header = () => {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

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
