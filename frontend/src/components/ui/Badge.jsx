import styles from "../../styles/ui.module.css";

const VARIANT_MAP = {
  success: styles.badgeSuccess,
  error: styles.badgeError,
  warning: styles.badgeWarning,
  info: styles.badgeInfo,
};

export default function Badge({ text, variant = "info" }) {
  const kind = VARIANT_MAP[variant] || "";
  return <span className={`${styles.badge} ${kind}`}>{text}</span>;
}
