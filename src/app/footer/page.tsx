'use client';

import Link from 'next/link';
import styles from './footer.module.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.section}>
          <h3 className={styles.title}>Smart Tools</h3>
          <p>Making digital tools smarter and more accessible.</p>
        </div>
        
        <div className={styles.section}>
          <h3 className={styles.title}>Quick Links</h3>
          <Link href="/" className={styles.link}>Home</Link>
          <Link href="/pdf-modifier" className={styles.link}>PDF Modifier</Link>
        </div>

        <div className={styles.section}>
          <h3 className={styles.title}>Connect</h3>
          <div className={styles.social}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
              aria-label="GitHub"
            >
              GitHub
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
              aria-label="Twitter"
            >
              Twitter
            </a>
          </div>
        </div>
      </div>
      
      <div className={styles.copyright}>
        © {currentYear} Smart Tools. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;