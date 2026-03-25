type Props = {
  error: string;
};

export function ErrorBanner({ error }: Props) {
  return <section className="glass border-accent-2 border-l-4 p-4 text-sm text-amber-900">{error}</section>;
}
