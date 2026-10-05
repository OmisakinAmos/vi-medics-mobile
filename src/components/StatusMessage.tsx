export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="empty-state" role="status"><strong>{label}</strong></div>;
}

export function ErrorMessage({ message }: { message: string }) {
  return <div className="empty-state" role="alert"><strong>Something went wrong</strong><p>{message}</p></div>;
}
