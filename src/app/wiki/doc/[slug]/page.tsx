import { notFound } from "next/navigation";
import { readDoc } from "@/lib/wiki/read";
import { Markdown } from "@/lib/wiki/markdown";
import { STANDING_LABEL } from "@/lib/wiki/docs";

export default async function WikiDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await readDoc(slug);
  if (!found) notFound();
  const { doc, source } = found;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-14 sm:px-10">
      <p className="text-[12px] text-faint">
        <span style={doc.standing === "designed" ? { color: "var(--tier)" } : undefined}>
          {STANDING_LABEL[doc.standing]}
        </span>
        {" · rendered from "}
        <code className="rounded bg-lift px-1">{doc.file}</code>
      </p>
      <div className="mt-8">
        <Markdown source={source} />
      </div>
    </main>
  );
}
