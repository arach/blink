import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererProps {
  content: string;
  syntaxHighlighting?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onDoubleClick?: () => void;
  title?: string;
}

export function MarkdownRenderer({
  content,
  syntaxHighlighting = true,
  style,
  className = "w-full h-full overflow-y-auto prose prose-invert max-w-none",
  onDoubleClick,
  title,
}: MarkdownRendererProps) {
  return (
    <div 
      className={className}
      onDoubleClick={onDoubleClick}
      title={title}
      style={style}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        rehypePlugins={syntaxHighlighting ? [rehypeHighlight] : []}
        components={{
          h1: ({children}) => <h1 className="text-2xl font-semibold mb-4 mt-6 first:mt-0">{children}</h1>,
          h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-5">{children}</h2>,
          h3: ({children}) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
          p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
          blockquote: ({children}) => (
            <blockquote className="border-l-4 border-l-primary/60 bg-muted/20 pl-4 py-2 my-4 italic">
              {children}
            </blockquote>
          ),
          code: ({inline, children}: {inline?: boolean, children?: React.ReactNode}) => (
            inline ?
              <code className="bg-muted px-1.5 py-0.5 rounded-xl text-sm font-mono">{children}</code> :
              <code className="block">{children}</code>
          ),
          pre: ({children}) => (
            <pre className="bg-muted/50 border border-border/30 rounded-2xl p-4 overflow-x-auto my-4">
              {children}
            </pre>
          ),
          ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          li: ({children}) => <li className="leading-relaxed">{children}</li>,
          a: ({href, children}) => (
            <a href={href} className="text-primary hover:underline font-medium">{children}</a>
          ),
          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
          em: ({children}) => <em className="italic">{children}</em>,
          hr: () => <hr className="border-border/30 my-6" />,
          table: ({children}) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border/30">
                {children}
              </table>
            </div>
          ),
          th: ({children}) => (
            <th className="border border-border/30 bg-muted/30 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({children}) => (
            <td className="border border-border/30 px-3 py-2">{children}</td>
          )
        }}
      >
        {content || '*Empty note*'}
      </ReactMarkdown>
    </div>
  );
}