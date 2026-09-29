interface SectionHeaderProps {
  title: string;
  description?: string;
}

export default function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="heading-3">{title}</h1>
      {description && (
        <p className="mt-2 text-sm text-text-muted">{description}</p>
      )}
    </div>
  );
}