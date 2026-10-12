'use client';

import { useEffect } from 'react';

export function LogoutNotice({ message }: { message: string }) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('reason') !== 'signed-out') return;
    url.searchParams.delete('reason');
    // Consume this navigation's notice without remounting the login form.
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);

  return (
    <p role="status" className="auth-notice">
      {message}
    </p>
  );
}
