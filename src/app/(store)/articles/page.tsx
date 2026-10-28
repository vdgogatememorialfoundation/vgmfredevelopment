import type { Metadata } from "next";
import { ArticlesIndex } from "@/components/articles/LiveArticles";

export const metadata: Metadata = {
  title: "Articles",
  description:
    "Articles and perspectives on Ayurveda, research, education and the legacy of Vaidya R. B. Gogate.",
};

export default function ArticlesPage() {
  return <ArticlesIndex />;
}
