import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import type { AnyExtension } from "@tiptap/core";

/** Base block set for the Tasks module's editor (Sección 4 del rediseño):
 * párrafo, títulos, listas con viñetas/numeradas, checklist, código, cita,
 * separador y links — everything StarterKit + TaskList/TaskItem/Link cover.
 *
 * Imágenes/Tablas/Callouts are deliberately NOT wired up yet (no image
 * upload pipeline, no table UI exists in this pass) — but Tiptap's
 * extension architecture is exactly what lets those be added later as one
 * more entry in this array, without rebuilding the editor. A Callout would
 * be a small custom Node extension; Tables/Images are official extensions
 * (`@tiptap/extension-table`, `@tiptap/extension-image`) not installed here. */
export function blockEditorExtensions(placeholder: string): AnyExtension[] {
  return [
    StarterKit.configure({
      // TaskList/TaskItem below replace StarterKit's plain bullet list for
      // checklist purposes — StarterKit's own bulletList/orderedList stay
      // enabled for plain (non-checklist) lists.
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({ openOnClick: false, autolink: true }),
    Placeholder.configure({ placeholder }),
  ];
}
