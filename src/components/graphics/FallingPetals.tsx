const petals = [
  { left: "6%", delay: "0s", duration: "14s", color: "#f97316" },
  { left: "18%", delay: "-6s", duration: "18s", color: "#e0457b" },
  { left: "32%", delay: "-2s", duration: "16s", color: "#f2a516" },
  { left: "47%", delay: "-9s", duration: "20s", color: "#f97316" },
  { left: "61%", delay: "-4s", duration: "15s", color: "#e0457b" },
  { left: "74%", delay: "-11s", duration: "19s", color: "#f2a516" },
  { left: "86%", delay: "-7s", duration: "17s", color: "#f97316" },
  { left: "94%", delay: "-13s", duration: "21s", color: "#e0457b" },
];

export default function FallingPetals() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {petals.map((petal) => (
        <span
          key={petal.left}
          className="petal"
          style={{
            left: petal.left,
            animationDelay: petal.delay,
            animationDuration: petal.duration,
            background: petal.color,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}
