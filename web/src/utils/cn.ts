import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 拼接条件类名并合并冲突的 Tailwind 原子类，供 TSX 的 class 绑定统一使用。 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
