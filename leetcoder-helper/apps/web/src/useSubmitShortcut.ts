import { useEffect, useRef } from 'react';

// ⌘+Enter on macOS, Ctrl+Enter elsewhere — the shortcut the buttons advertise.
export function useSubmitShortcut(onSubmit: () => void) {
  const latest = useRef(onSubmit);
  latest.current = onSubmit;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      latest.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
