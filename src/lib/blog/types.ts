export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  description: string;
  category: string;
  categorySlug: string;
  tags: string[];
  tagSlugs: string[];
  author: string;
  publishDate: string;
  lastModified: string;
  readingTime: number;
  featuredImage: string | null;
  imageAlt: string;
  featured: boolean;
}

export interface BlogPost extends BlogPostSummary {
  keywords: string[];
  canonical: string | null;
  seoTitle: string;
  seoDescription: string;
  ogTitle: string;
  ogDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  html: string;
  plain: string;
  toc: TocItem[];
  raw: string;
  source: string;
}
