import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1 className={styles.title}>Collection Smart Tools</h1>
        <p className={styles.description}>
          Tools to help you with daily tasks
        </p>
      </main>
    </div>
  );
}
