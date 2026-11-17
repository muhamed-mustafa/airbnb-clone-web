/**
 * An email shown in full: left-to-right inside RTL text. The only preferred break is after
 * "@", so the domain stays together ("example.com", never "example." + "com"); a value too
 * long for its line still breaks anywhere rather than overflowing. Never truncated.
 */
export function EmailText({ email, className = '' }: { email: string; className?: string }) {
  const at = email.lastIndexOf('@');
  if (at < 0) {
    return (
      <bdi dir="ltr" className={`email-text ${className}`}>
        {email}
      </bdi>
    );
  }
  return (
    <bdi dir="ltr" className={`email-text ${className}`}>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </bdi>
  );
}
