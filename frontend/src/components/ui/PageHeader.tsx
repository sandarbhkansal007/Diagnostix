interface PageHeaderProps {
  readonly title: string;
}

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="page-header">
      <p className="page-header__eyebrow">PATIENT PORTAL</p>
      <h1>{title}</h1>
      <p className="page-header__description">This section is a placeholder for a future phase.</p>
    </header>
  );
}