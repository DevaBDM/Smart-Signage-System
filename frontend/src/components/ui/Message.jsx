import styles from "../../styles/ui.module.css";

export default function Message({ text }) {
  const kind = text?.startsWith("✅")
    ? styles.messageSuccess
    : text?.startsWith("⚠️")
      ? styles.messageWarning
      : styles.messageError;

  return <div className={`${styles.message} ${kind}`}>{text}</div>;
}
