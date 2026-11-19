const paths: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  office: "M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M9 21v-4h4v4M8 7h.01M12 7h.01M8 11h.01M12 11h.01M8 15h.01M12 15h.01M19 21V9h3v12",
  address: "M12 22s-8-6.6-8-12.5a8 8 0 0 1 16 0C20 15.4 12 22 12 22zM8.5 11 12 8l3.5 3v3.5h-7z",
  pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  truck: "M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  store: "M3 9 5 4h14l2 5M4 9h16v11H4zM9 20v-6h6v6",
  card: "M3 7h18v10H3zM3 11h18M7 15h4",
  shield: "M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z",
  heart: "M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z",
  trash: "M4 7h16M9 7V5h6v2M8 7l1 12h6l1-12",
  plus: "M12 5v14M5 12h14",
  package: "M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8M12 12v8",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  tag: "M3 12V5h7l11 11-7 7zM8 8h.01",
};

export default function Glyph({ name, className = "h-4 w-4" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
