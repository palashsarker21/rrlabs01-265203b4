import { useState } from "react";
import { Copy, Check, Linkedin, Twitter } from "lucide-react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const twitterHref = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;

  const handleCopy = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) return;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silent — clipboard access can be denied by the browser.
    }
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-md border border-border/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary";

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this article">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Share</span>
      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label="Share on X"
      >
        <Twitter className="h-3.5 w-3.5" /> X
      </a>
      <a
        href={linkedinHref}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label="Share on LinkedIn"
      >
        <Linkedin className="h-3.5 w-3.5" /> LinkedIn
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className={btn}
        aria-label="Copy link to article"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
