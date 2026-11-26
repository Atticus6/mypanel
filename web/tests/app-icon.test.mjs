import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { baseParse, compile } from '@vue/compiler-dom';
import { parse } from '@vue/compiler-sfc';
import { ElAvatar } from 'element-plus/es/components/avatar/index.mjs';
import ts from 'typescript';
import * as Vue from 'vue';
import { isRemoteAppIcon, resolveAppIconUrl } from '../src/utils/app-icon.ts';

const cdnURL = 'https://cdn.example/icons/php.png?v=abc123&token=a%2Bb#icon';
const apiURL = '/api/v2';
const getAppIconUrl = (key, node, icon = '') => resolveAppIconUrl(key, node, icon, apiURL);

test('accepts absolute HTTP(S) image URLs without changing their query or fragment', () => {
    for (const icon of [
        cdnURL,
        'http://cdn.example/icon.png',
        'HTTPS://cdn.example:443/icon.png',
        'https://[::1]/icon',
    ]) {
        assert.equal(isRemoteAppIcon(icon), true, icon);
        assert.equal(getAppIconUrl('php', 'child-node', icon), icon);
    }
});

test('rejects unsafe schemes, credentials, normalization ambiguities and malformed URLs', () => {
    for (const icon of [
        '//cdn.example/icon.png',
        'https:cdn.example/icon.png',
        'https:///icon.png',
        'javascript:alert(1)',
        'data:image/png;base64,eA==',
        'file:///tmp/icon.png',
        'https://user:password@cdn.example/icon.png',
        'https://@cdn.example/icon.png',
        'https://cdn.example:bad/icon.png',
        'https://cdn.example:65536/icon.png',
        'https://cdn.example/%zz',
        'https://cdn.example/icon.png?token=%zz',
        ' https://cdn.example/icon.png',
        'https://cdn.example/icon.png\n',
        'https://cdn.example/\u00a0icon.png',
        'https://cdn.example/\u0085icon.png',
        'https://cdn.example\\other/icon.png',
    ]) {
        assert.equal(isRemoteAppIcon(icon), false, icon);
        assert.equal(getAppIconUrl('php', 'child-node', icon), '/api/v2/apps/icon/php?operateNode=child-node');
    }
});

test('keeps historical icons and missing fields on the original node-aware API', () => {
    for (const icon of ['', undefined, 'app_php.png?etag=%22old%22', 'aGlzdG9yaWNhbC1pbWFnZQ==']) {
        assert.equal(
            getAppIconUrl('local-php', 'child & node', icon),
            '/api/v2/apps/icon/local-php?operateNode=child%20%26%20node',
        );
    }
    assert.equal(getAppIconUrl('php'), '/api/v2/apps/icon/php');
});

const readView = (name) => readFileSync(new URL(`../src/views/${name}`, import.meta.url), 'utf8');

function launcherResolver() {
    const source = readView('home/app/index.tsx');
    const ast = ts.createSourceFile('launcher.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const match = source.match(/const getAppIconSrc = ([\s\S]*?\n        \});/);
    assert.ok(match, 'getAppIconSrc must exist in the launcher TSX');
    const expression = ts.transpileModule(`const getAppIconSrc = ${match[1]};`, {
        compilerOptions: { target: ts.ScriptTarget.ESNext },
    }).outputText;
    return new Function('isRemoteAppIcon', 'getAppIconUrl', `${expression}\nreturn getAppIconSrc;`)(
        isRemoteAppIcon,
        getAppIconUrl,
    );
}

test('home launcher uses CDN URLs and retains inline historical Base64 icons', () => {
    const getAppIconSrc = launcherResolver();
    assert.equal(getAppIconSrc({ key: 'php', icon: cdnURL }), cdnURL);
    assert.equal(
        getAppIconSrc({ key: 'php', icon: 'aGlzdG9yaWNhbC1pbWFnZQ==' }),
        'data:image/png;base64,aGlzdG9yaWNhbC1pbWFnZQ==',
    );
    assert.equal(getAppIconSrc({ key: 'php', icon: 'app_php.png?etag=old' }), '/api/v2/apps/icon/php');
    assert.equal(getAppIconSrc({ key: 'php' }), '/api/v2/apps/icon/php');
});

for (const view of [
    'app-store/apps/app/index.tsx',
    'app-store/detail/index.tsx',
    'app-store/installed/app/icon.tsx',
    'home/app/index.tsx',
]) {
    test(`${view}: actual avatar binding loads CDN once and displays the local fallback on error`, async () => {
        const source = readView(view);
        assert.ok(source.includes('<ElAvatar'), 'image entry must use ElAvatar');
        assert.ok(source.includes('p-appstore'), 'failed avatar must fall back to local icon');
        assert.ok(
            source.includes('getAppIconUrl(') || source.includes('getAppIconSrc('),
            'avatar src must come from the app icon resolver',
        );
    });
}

test('installed card passes the API icon URL through to the actual icon child component', () => {
    const source = readView('app-store/installed/app/card.tsx');
    assert.ok(source.includes('icon={'), 'card must pass the icon value to the icon child');
    assert.ok(source.includes('<AppIcon'), 'card must render AppIcon');
});
