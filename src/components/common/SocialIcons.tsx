import { siteConfig } from "@/lib/constants";
import { classNames } from "@/lib/utils";

const icons = {
  facebook: "M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z",
  instagram: "M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 3c-2.4 0-2.7 0-3.7.1-3.2.1-5 1.9-5.2 5.2C3 9.3 3 9.6 3 12s0 2.7.1 3.7c.1 3.2 1.9 5 5.2 5.2 1 .1 1.3.1 3.7.1s2.7 0 3.7-.1c3.2-.1 5-1.9 5.2-5.2.1-1 .1-1.3.1-3.7s0-2.7-.1-3.7c-.1-3.2-1.9-5-5.2-5.2C14.7 3 14.4 3 12 3z",
  linkedin: "M6.9 8.8H3.4V20h3.5zM5.2 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM20.6 13.7c0-3-.7-5.2-4.1-5.2-1.7 0-2.8.9-3.2 1.8h-.1V8.8H9.9V20h3.5v-5.6c0-1.5.3-2.9 2.1-2.9s1.8 1.7 1.8 3V20h3.4z",
  youtube: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z",
  twitter: "M17.7 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L1.8 3h6.4l4.4 5.9zm-1.1 16.2h1.7L7.5 4.7H5.6z",
} as const;

const labels: Record<keyof typeof icons, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  twitter: "X (Twitter)",
};

export default function SocialIcons({
  className,
  itemClassName,
}: {
  className?: string;
  itemClassName?: string;
}) {
  const keys = Object.keys(icons) as (keyof typeof icons)[];
  return (
    <ul className={classNames("flex items-center gap-2", className)} role="list">
      {keys.map((key) => (
        <li key={key}>
          <a
            href={siteConfig.social[key]}
            aria-label={labels[key]}
            target="_blank"
            rel="noopener noreferrer"
            className={classNames(
              "flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition duration-300 hover:-translate-y-0.5 hover:border-gold hover:bg-gold hover:text-navy",
              itemClassName
            )}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d={icons[key]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
