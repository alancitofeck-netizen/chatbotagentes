"use client";

import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Minus,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { updateTaskDescription } from "@/lib/tasks/actions";
import { blockEditorExtensions } from "./extensions";
import styles from "./BlockEditor.module.css";

const SAVE_DEBOUNCE_MS = 800;

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-surface-3 hover:text-foreground",
        active && "bg-accent-100 text-accent-700 hover:bg-accent-100 hover:text-accent-700",
      )}
    >
      {children}
    </button>
  );
}

/** Wraps Tiptap's useEditor/EditorContent — the block editor for a task's
 * description (Sección 4 del rediseño). Autosaves both the Tiptap JSON doc
 * and a derived plain-text extract via updateTaskDescription, debounced so
 * every keystroke doesn't hit the server. */
export function BlockEditor({ taskId, initialJson }: { taskId: string; initialJson: unknown | null }) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: blockEditorExtensions("Escribí una descripción, agregá una lista o un checklist…"),
    content: (initialJson as object | null) ?? "",
    immediatelyRender: false,
    editorProps: { attributes: { class: styles.content } },
    onUpdate: ({ editor: e }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateTaskDescription(taskId, e.getJSON(), e.getText());
      }, SAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-1">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border-default px-2 py-1.5">
        <ToolbarButton label="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Código" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <Code className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border-default" aria-hidden="true" />
        <ToolbarButton
          label="Título 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Título 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border-default" aria-hidden="true" />
        <ToolbarButton label="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListTodo className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border-default" aria-hidden="true" />
        <ToolbarButton label="Cita" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="size-4" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL del link");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          <LinkIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
      </div>
      <div className="px-3 py-2.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
