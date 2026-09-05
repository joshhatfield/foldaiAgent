import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Memoized markdown renderer — avoids re-parsing the full AST on every
 * streaming token for messages that haven't changed.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("space-y-2 break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-background/50 p-3 text-xs">{children}</pre>
          ),
          code: ({ className: cls, children, ...props }) => {
            const isInline = !cls?.includes("language-");
            if (isInline) {
              return (
                <code className="rounded bg-background/50 px-1 py-0.5 text-xs" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={cn("font-mono text-xs", cls)} {...props}>
                {children}
              </code>
            );
          },
          a: ({ children, ...props }) => (
            <a className="underline underline-offset-2" target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1">{children}</ol>,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});