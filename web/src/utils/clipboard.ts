import i18n from '@/lang';
import { MsgError, MsgSuccess } from '@/utils/message';

/** 用 navigator.clipboard 写入；不支持或失败时退回隐藏 textarea + execCommand。 */
export async function writeClipboardText(
    text: string,
    doc: Document = document,
    nav: Navigator = navigator,
): Promise<void> {
    if (nav.clipboard?.writeText) {
        try {
            await nav.clipboard.writeText(text);
            return;
        } catch {
            // 权限被拒或非安全上下文时走下面的兜底方案。
        }
    }
    const textarea = doc.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    try {
        textarea.select();
        if (!doc.execCommand('copy')) throw new Error('copy failed');
    } finally {
        textarea.remove();
    }
}

export async function copyText(content: string) {
    try {
        await writeClipboardText(content);
        MsgSuccess(i18n.global.t('commons.msg.copySuccess'));
    } catch {
        MsgError(i18n.global.t('commons.msg.copyFailed'));
    }
}
