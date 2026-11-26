import { describe, expect, test } from 'bun:test';
import { transformConditionalJSX } from './conditional';

describe('transformConditionalJSX', () => {
    test('子节点里的 v-if 转成条件表达式', () => {
        expect(transformConditionalJSX('<div><span v-if={ok}>A</span></div>')).toBe(
            '<div>{ok ? <span>A</span> : null}</div>',
        );
    });

    test('v-if / v-else 组成完整分支', () => {
        const code = '<div><span v-if={ok}>A</span><span v-else>B</span></div>';
        expect(transformConditionalJSX(code)).toBe('<div>{ok ? <span>A</span> : <span>B</span>}</div>');
    });

    test('v-else-if 串接多个分支', () => {
        const code = '<div><i v-if={a}>A</i><i v-else-if={b}>B</i><i v-else>C</i></div>';
        expect(transformConditionalJSX(code)).toBe('<div>{a ? <i>A</i> : b ? <i>B</i> : <i>C</i>}</div>');
    });

    test('return 位置的单个 v-if 不加花括号', () => {
        const code = 'const A = () => <div v-if={ok}>A</div>;';
        expect(transformConditionalJSX(code)).toBe('const A = () => ok ? <div>A</div> : null;');
    });

    test('v-show 保留给运行时处理', () => {
        const code = '<div v-show={ok}>A</div>';
        expect(transformConditionalJSX(code)).toBe(code);
    });
});
