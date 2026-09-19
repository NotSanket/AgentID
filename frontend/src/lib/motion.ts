import type { Transition, Variants } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;
export const swiftTransition: Transition = { duration: 0.28, ease };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: swiftTransition },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: swiftTransition },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: swiftTransition },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -14 },
  visible: { opacity: 1, x: 0, transition: swiftTransition },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 7 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

export const staggerChildren: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
