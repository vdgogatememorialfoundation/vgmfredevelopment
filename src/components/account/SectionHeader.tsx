interface SectionHeaderProps {
  title: string;
  description?: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="heading-3">{title}</h1>
    </div>
  );
}