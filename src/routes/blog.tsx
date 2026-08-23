import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { BLOG_POSTS } from "@/lib/marketing/posts";

export const Route = createFileRoute("/blog")({
  component: BlogIndex,
});

function BlogIndex() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-black tracking-tighter">Journal</h1>
        <ul className="mt-10 space-y-6">
          {BLOG_POSTS.map((p) => (
            <li key={p.slug}>
              <Link
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="block rounded-2xl border border-border bg-surface p-5 hover:border-primary/50"
              >
                <p className="text-xs text-muted-foreground">{p.date}</p>
                <p className="mt-1 text-lg font-semibold">{p.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.dek}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </MarketingShell>
  );
}
