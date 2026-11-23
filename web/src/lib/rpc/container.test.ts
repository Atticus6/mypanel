import { describe, expect, test } from 'bun:test';
import { create } from '@bufbuild/protobuf';

import { ContainerSchema } from '@/gen/panel/agent/v1/container_pb';
import { toContainerView } from './container';

describe('toContainerView', () => {
    test('containerId 映射成页面使用的 containerID', () => {
        const item = create(ContainerSchema, {
            containerId: 'abc123',
            imageId: 'sha256:deadbeef',
            name: 'web',
            state: 'running',
        });
        const view = toContainerView(item);
        expect(view.containerID).toBe('abc123');
        expect(view.imageID).toBe('sha256:deadbeef');
        expect(view.name).toBe('web');
        expect(view.state).toBe('running');
    });

    test('保留网络与端口列表', () => {
        const item = create(ContainerSchema, {
            containerId: 'c1',
            network: ['bridge'],
            ports: ['80:80'],
        });
        const view = toContainerView(item);
        expect(view.network).toEqual(['bridge']);
        expect(view.ports).toEqual(['80:80']);
    });
});
