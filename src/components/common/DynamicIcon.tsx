import {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  HeartHandshake,
  Images,
  Landmark,
  Library,
  Microscope,
  Milestone,
  Newspaper,
  PlayCircle,
  Presentation,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  HeartHandshake,
  Images,
  Landmark,
  Library,
  Microscope,
  Milestone,
  Newspaper,
  PlayCircle,
  Presentation,
  ShieldCheck,
  Sparkles,
  Sprout,
  Stethoscope,
  Users,
};

export default function DynamicIcon({
  name,
  ...props
}: { name: string } & LucideProps) {
  const Icon = icons[name] ?? Sparkles;
  return <Icon {...props} />;
}
