import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { postBySlug } from "@/lib/marketing/posts";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  const post = postBySlug(slug);
  if (!post) {
    return (
      <MarketingShell>
        <main className="mx-auto max-w-3xl px-4 py-16">
          <p className="text-sm text-muted-foreground">Not found.</p>
          <Link to="/blog" className="mt-4 inline-block text-sm text-primary">
            Journal
          </Link>
        </main>
      </MarketingShell>
    );
  }
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Link to="/blog" className="text-xs text-muted-foreground hover:text-foreground">
          Journal
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">{post.date}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tighter">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{post.dek}</p>
        <div className="mt-8 space-y-4 text-sm leading-relaxed text-foreground">
          {post.body.map((para) => (
            <p key={para.slice(0, 24)}>{para}</p>
          ))}
        </div>
      </main>
    </MarketingShell>
  );
}
