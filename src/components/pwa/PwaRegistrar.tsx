"use client";

import { useEffect } from "react";

export default function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("Não foi possível instalar o modo offline do WeedReset.", error);
    });
  }, []);
  return null;
}
