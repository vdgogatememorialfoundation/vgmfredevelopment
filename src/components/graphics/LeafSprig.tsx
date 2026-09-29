import { classNames } from "@/lib/utils";

const leaves = [
  { y: 20, side: -1 },
  { y: 34, side: 1 },
  { y: 48, side: -1 },
  { y: 62, side: 1 },
  { y: 76, side: -1 },
];

export default function LeafSprig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 110" aria-hidden="true" className={classNames("pointer-events-none", className)}>
      <path d="M30 105 C 28 80, 32 40, 30 8" fill="none" stroke="#2f8a3e" strokeWidth="2" strokeLinecap="round" />
      {leaves.map((leaf) => (
        <path
          key={leaf.y}
          d={`M30 ${leaf.y} C ${30 + leaf.side * 8} ${leaf.y - 12}, ${30 + leaf.side * 24} ${leaf.y - 8}, ${30 + leaf.side * 26} ${leaf.y + 2} C ${30 + leaf.side * 18} ${leaf.y + 8}, ${30 + leaf.side * 6} ${leaf.y + 6}, 30 ${leaf.y} Z`}
          fill={leaf.y % 28 === 20 ? "#4caf50" : "#2f8a3e"}
        />
      ))}
      <circle cx="30" cy="8" r="4" fill="#e0457b" />
    </svg>
  );
}
