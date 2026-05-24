import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zh from "./locales/zh.json";
import en from "./locales/en.json";

const saved = typeof window !== "undefined" ? localStorage.getItem("app-lang") : null;

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: saved || "zh",
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: "zh" | "en") {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") localStorage.setItem("app-lang", lang);
}

export default i18n;
