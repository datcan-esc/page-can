import { browser } from 'wxt/browser';
import { BOOKMARK_CARD_LIMIT } from './display-limits';
import type { BookmarkItem } from './types';

interface RawBookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: RawBookmarkNode[];
}

function toBookmarkItem(node: RawBookmarkNode, path = ''): BookmarkItem | null {
  if (!node.url) return null;
  return {
    id: node.id,
    title: node.title || node.url,
    url: node.url,
    dateAdded: node.dateAdded ?? 0,
    path,
  };
}

export async function loadRecentBookmarks(): Promise<BookmarkItem[]> {
  const nodes = await browser.bookmarks.getRecent(BOOKMARK_CARD_LIMIT) as RawBookmarkNode[];
  return nodes
    .map((node) => toBookmarkItem(node))
    .filter((item): item is BookmarkItem => item !== null);
}

export async function loadAllBookmarks(): Promise<BookmarkItem[]> {
  const roots = await browser.bookmarks.getTree() as RawBookmarkNode[];
  const flat: BookmarkItem[] = [];

  const walk = (nodes: RawBookmarkNode[], path: string[]) => {
    for (const node of nodes) {
      const nextPath = node.title ? [...path, node.title] : path;
      const item = toBookmarkItem(node, path.filter(Boolean).join(' / '));
      if (item) flat.push(item);
      if (node.children) walk(node.children, nextPath);
    }
  };

  walk(roots, []);
  return flat;
}

export async function removeBookmark(id: string): Promise<void> {
  await browser.bookmarks.remove(id);
}
