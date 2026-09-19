import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "mail:bodyTheme";
const CHANGE_EVENT = "mail:bodyThemeChange";

function readLight() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "dark";
  } catch {
    return true;
  }
}

/**
 * Whether email content (thread view, composers) renders on a white background.
 * Defaults to white; the choice is saved per browser and shared by every mail view.
 */
export function useMailBodyTheme() {
  const [lightBody, setLightBody] = useState(true);

  useEffect(() => {
    setLightBody(readLight());
    const sync = () => setLightBody(readLight());
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const toggleBodyTheme = useCallback(() => {
    const next = !readLight();
    try {
      localStorage.setItem(STORAGE_KEY, next ? "light" : "dark");
    } catch {}
    setLightBody(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { lightBody, toggleBodyTheme };
}
