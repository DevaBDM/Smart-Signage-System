import styles from "../../styles/ui.module.css";

const VARIANT_MAP = {
  primary: styles.btnPrimary,
  purple: styles.btnPurple,
  danger: styles.btnDanger,
  success: styles.btnSuccess,
  ghost: styles.btnGhost,
};

export default function Button({
  children,
  variant = "primary",
  size,
  type = "button",
  disabled,
  onClick,
  className = "",
}) {
  const sizeClass = size === "small" ? styles.btnSmall : "";
  const variantClass = VARIANT_MAP[variant] || "";
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${styles.btn} ${variantClass} ${sizeClass} ${className}`}
    >
      {children}
    </button>
  );
}
