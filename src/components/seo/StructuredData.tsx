/** JSON-LD for one page. `<` is escaped so stored text cannot close the script tag. */
export function StructuredData({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
