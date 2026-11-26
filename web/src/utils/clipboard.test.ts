import { describe, expect, test } from 'bun:test';
import { writeClipboardText } from './clipboard';

describe('writeClipboardText', () => {
    test('优先使用 navigator.clipboard', async () => {
        let written = '';
        const nav = { clipboard: { writeText: async (text: string) => (written = text) } } as Navigator;
        await writeClipboardText('hello', {} as Document, nav);
        expect(written).toBe('hello');
    });

    test('没有 clipboard API 时用 execCommand 兜底', async () => {
        let copied = false;
        let removed = false;
        const textarea = {
            value: '',
            style: {} as CSSStyleDeclaration,
            setAttribute: () => {},
            select: () => {},
            remove: () => (removed = true),
        } as unknown as HTMLTextAreaElement;
        const doc = {
            createElement: () => textarea,
            body: { appendChild: () => {} },
            execCommand: () => {
                copied = true;
                return true;
            },
        } as unknown as Document;
        await writeClipboardText('fallback', doc, {} as Navigator);
        expect(textarea.value).toBe('fallback');
        expect(copied).toBe(true);
        expect(removed).toBe(true);
    });
});
