"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

export function TiptapEditor({
  content,
  onChange,
  placeholder = "Write lesson content…",
}: {
  content: unknown;
  onChange: (json: unknown, html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: content && typeof content === "object" ? content : undefined,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getJSON(), ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[200px] px-3 py-2 focus:outline-none text-storm-navy",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (content && JSON.stringify(current) !== JSON.stringify(content)) {
      editor.commands.setContent(content as object);
    }
  }, [content, editor]);

  if (!editor) return <div className="min-h-[200px] rounded-lg border bg-storm-light-grey/30" />;

  return (
    <div className="rounded-lg border border-storm-light-blue/60 bg-white">
      <div className="flex flex-wrap gap-1 border-b border-storm-light-blue/40 p-2">
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          label="B"
        />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          label="I"
        />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          label="H2"
        />
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          label="List"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  onClick,
  active,
  label,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 rounded px-2 text-xs font-semibold ${
        active ? "bg-storm-medium-blue text-white" : "bg-storm-light-grey text-storm-navy"
      }`}
    >
      {label}
    </button>
  );
}
