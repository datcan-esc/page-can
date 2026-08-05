import { browser } from 'wxt/browser';
import type { BookmarkItem, BookmarkTreeItem } from './types';

interface RawBookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: RawBookmarkNode[];
}

export async function loadBookmarkData(): Promise<{
  recent: BookmarkItem[];
  tree: BookmarkTreeItem[];
  flat: BookmarkItem[];
}> {
  const roots = await browser.bookmarks.getTree() as RawBookmarkNode[];
  const flat: BookmarkItem[] = [];

  const walk = (nodes: RawBookmarkNode[], path: string[]) => {
    for (const node of nodes) {
      const nextPath = node.title ? [...path, node.title] : path;
      if (node.url) {
        flat.push({
          id: node.id,
          title: node.title || node.url,
          url: node.url,
          dateAdded: node.dateAdded ?? 0,
          path: path.filter(Boolean).join(' / '),
        });
      }
      if (node.children) walk(node.children, nextPath);
    }
  };

  walk(roots, []);
  const recent = [...flat]
    .sort((left, right) => right.dateAdded - left.dateAdded)
    .slice(0, 5);

  const tree = (roots[0]?.children ?? []) as BookmarkTreeItem[];
  return { recent, tree, flat };
}

export async function removeBookmark(id: string): Promise<void> {
  await browser.bookmarks.remove(id);
}
