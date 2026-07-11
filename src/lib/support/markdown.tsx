import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Lightweight Markdown → React for Success Center articles.
 * Supports headings, paragraphs, lists, bold, italic, and links.
 */
export function renderSupportMarkdown(markdown: string): ReactNode {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(
        createElement(
          "h3",
          { key: key++, className: "mt-6 text-lg font-semibold text-zinc-900" },
          inline(line.slice(4))
        )
      );
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        createElement(
          "h2",
          { key: key++, className: "mt-8 text-xl font-semibold text-zinc-900" },
          inline(line.slice(3))
        )
      );
      i += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(
        createElement(
          "h1",
          { key: key++, className: "mt-6 text-2xl font-bold text-zinc-900" },
          inline(line.slice(2))
        )
      );
      i += 1;
      continue;
    }

    if (line.trim().startsWith("- ")) {
      const items: ReactNode[] = [];
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("- ")) {
        items.push(
          createElement(
            "li",
            { key: key++, className: "leading-relaxed text-zinc-700" },
            inline((lines[i] ?? "").trim().slice(2))
          )
        );
        i += 1;
      }
      blocks.push(
        createElement(
          "ul",
          { key: key++, className: "mt-3 list-disc space-y-1.5 pl-5" },
          items
        )
      );
      continue;
    }

    if (/^\d+\.\s/.test(line.trim())) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test((lines[i] ?? "").trim())) {
        items.push(
          createElement(
            "li",
            { key: key++, className: "leading-relaxed text-zinc-700" },
            inline((lines[i] ?? "").trim().replace(/^\d+\.\s/, ""))
          )
        );
        i += 1;
      }
      blocks.push(
        createElement(
          "ol",
          { key: key++, className: "mt-3 list-decimal space-y-1.5 pl-5" },
          items
        )
      );
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !(lines[i] ?? "").startsWith("#") &&
      !(lines[i] ?? "").trim().startsWith("- ") &&
      !/^\d+\.\s/.test((lines[i] ?? "").trim())
    ) {
      para.push(lines[i] ?? "");
      i += 1;
    }
    blocks.push(
      createElement(
        "p",
        { key: key++, className: "mt-3 leading-relaxed text-zinc-700" },
        inline(para.join(" "))
      )
    );
  }

  return createElement(Fragment, null, blocks);
}

function inline(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(
        createElement("strong", { key: `b${k++}` }, token.slice(2, -2))
      );
    } else if (token.startsWith("*")) {
      nodes.push(createElement("em", { key: `i${k++}` }, token.slice(1, -1)));
    } else {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          createElement(
            "a",
            {
              key: `a${k++}`,
              href: linkMatch[2],
              className: "font-medium text-[#2436BB] underline-offset-2 hover:underline",
            },
            linkMatch[1]
          )
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length === 1 ? nodes[0] : createElement(Fragment, null, nodes);
}
