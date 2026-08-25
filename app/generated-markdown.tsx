import { Fragment, type ReactNode } from "react";
import { parseGeneratedMarkdown, type MarkdownInline } from "./generated-markdown-parser";

function InlineContent({ content }: { content: MarkdownInline[] }) {
  return content.map((item, index): ReactNode => {
    if (item.kind === "text") return <Fragment key={index}>{item.value}</Fragment>;
    if (item.kind === "strong") return <strong key={index}><InlineContent content={item.children} /></strong>;
    return <em key={index}><InlineContent content={item.children} /></em>;
  });
}

export function GeneratedMarkdown({ content }: { content: string }) {
  return <div className="f2-generated-markdown">{parseGeneratedMarkdown(content).map((block, index) => {
    if (block.kind === "heading") {
      const Heading = block.level <= 2 ? "h3" : "h4";
      return <Heading key={index}><InlineContent content={block.children} /></Heading>;
    }
    if (block.kind === "paragraph") return <p key={index}>{block.lines.map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <br />}<InlineContent content={line} /></Fragment>)}</p>;
    const List = block.kind === "ordered-list" ? "ol" : "ul";
    return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineContent content={item} /></li>)}</List>;
  })}</div>;
}
