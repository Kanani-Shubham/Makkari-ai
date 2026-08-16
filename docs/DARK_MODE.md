# Makkari AI — Dark Mode & Theme System Guide

## 1. Architecture

Makkari implements a 3-way theme system:
- **Light**: Crisp warm background (`#F7F6F3`), Terracotta accent (`#D97757`), stone borders (`#E8E5E0`).
- **Dark**: Deep OLED background (`#121212`), surface cards (`#1E1E1E` / `#242424`), border (`#2E2E2E`), high-contrast text (`#E5E5E5`).
- **System**: Automatically synchronizes with OS preference (`prefers-color-scheme: dark`).

---

## 2. Anti-Flash Hydration

To prevent white flash on initial page load before React mounts, an inline script runs synchronously in `app/layout.tsx`:

```javascript
(function() {
  try {
    var theme = localStorage.getItem('makkari-theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
```

When users toggle themes in Settings → General or Settings → Appearance, `handleThemeChange` persists the selection immediately to `localStorage` and updates the user profile in Supabase.
