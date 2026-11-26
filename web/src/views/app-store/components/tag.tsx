import { ArrowDown } from '@element-plus/icons-vue';
import { $t } from '@/utils/i18n-t';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
import './tag.styles.css';
import { defineComponent, Fragment, unref, withDirectives, computed } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import { ElCheckTag } from 'element-plus';
import { ElDropdown } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElDropdownMenu } from 'element-plus';
import { ElDropdownItem } from 'element-plus';
interface CodemodProps {
    [key: string]: any;
    hideKey?: string;
}
const emits = {
    'change': (...args: unknown[]) => true,
};
const options = {
        name: "tag",
        props: {
    "hideKey": {
        type: String,
        default: '',
    },
} as unknown as ComponentObjectPropsOptions<CodemodProps>,
        emits: emits,
        __scopeId: "data-v-621cafdb",
};
export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const containerRef = ref<HTMLElement>();
        const activeTag = ref('all');
        const tags = ref<{ key: string; name: string }[]>([]);
        const moreTag = ref('');
        const visibleTagCount = ref(7);
        const allMeasureRef = ref();
        const moreMeasureRef = ref();
        const measureTagRefs: Record<string, any> = {};
        const visibleTags = computed(() => tags.value.slice(0, visibleTagCount.value));
        const hiddenTags = computed(() => tags.value.slice(visibleTagCount.value));
        const moreLabel = computed(() => {
            if (moreTag.value === '') {
                return i18n.global.t('tabs.more');
            }
            return getTagValue(moreTag.value) || i18n.global.t('tabs.more');
        });
        const getTagValue = (key: string) => {
            const tag = tags.value.find((tag) => tag.key === key);
            if (tag) {
                return tag.name;
            }
            return '';
        };
        const setMeasureTagRef = (key: string, el: any) => {
            if (el) {
                measureTagRefs[key] = el;
                return;
            }
            delete measureTagRefs[key];
        };
        const getElementWidth = (target: any) => {
            const el = target?.$el || target;
            if (!(el instanceof HTMLElement)) {
                return 0;
            }
            return el.getBoundingClientRect().width;
        };
        const getContainerGap = () => {
            if (!containerRef.value) {
                return 0;
            }
            const styles = window.getComputedStyle(containerRef.value);
            const gap = Number.parseFloat(styles.columnGap || styles.gap || '0');
            return Number.isNaN(gap) ? 0 : gap;
        };
        const changeTag = (key: string) => {
            activeTag.value = key;
            ctx.emit('change', key);
            const index = tags.value.findIndex((tag) => tag.key === key);
            if (index >= visibleTagCount.value) {
                moreTag.value = key;
            } else {
                moreTag.value = '';
            }
            nextTick(() => {
                calculateVisibleTagCount();
            });
        };
        const calculateVisibleTagCount = () => {
            if (!containerRef.value) return;
        
            const safeReserve = 8;
            const containerWidth = containerRef.value.getBoundingClientRect().width - safeReserve;
            const gap = getContainerGap();
            const allWidth = getElementWidth(allMeasureRef.value);
            const moreWidth = getElementWidth(moreMeasureRef.value);
        
            if (!containerWidth || !allWidth) {
                return;
            }
        
            let usedWidth = allWidth;
            let count = 0;
        
            for (let i = 0; i < tags.value.length; i++) {
                const currentWidth = getElementWidth(measureTagRefs[tags.value[i].key]);
                if (!currentWidth) {
                    continue;
                }
        
                const hasRemainingTags = i < tags.value.length - 1;
                const nextWidth = usedWidth + gap + currentWidth + (hasRemainingTags ? gap + moreWidth : 0);
        
                if (nextWidth <= containerWidth) {
                    usedWidth += gap + currentWidth;
                    count++;
                    continue;
                }
        
                break;
            }
        
            visibleTagCount.value = count;
        
            const activeIndex = tags.value.findIndex((tag) => tag.key === activeTag.value);
            const expectedMoreTag = activeIndex >= visibleTagCount.value ? activeTag.value : '';
            if (expectedMoreTag !== moreTag.value) {
                moreTag.value = expectedMoreTag;
                nextTick(() => {
                    calculateVisibleTagCount();
                });
            }
        };
        let resizeObserver: ResizeObserver | null = null;
        const initResizeObserver = () => {
            if (!containerRef.value) return;
        
            resizeObserver = new ResizeObserver(() => {
                calculateVisibleTagCount();
            });
        
            resizeObserver.observe(containerRef.value);
        };
        const getTags = async () => {
            const items = (await rpc.app.getAppTags({})).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].key === __panelSetupProps.hideKey) {
                    items.splice(i, 1);
                    break;
                }
            }
            tags.value = items;
            nextTick(() => {
                calculateVisibleTagCount();
            });
        };
        onMounted(() => {
            getTags();
            nextTick(() => {
                initResizeObserver();
            });
        });
        onBeforeUnmount(() => {
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        });
        return () => (
            <>
            <div ref={containerRef} class={"tag-container flex gap-2"}><ElCheckTag checked={unref(activeTag) == 'all'} onClick={($event?: any) => { changeTag('all'); }}>{$t('app.all')}</ElCheckTag>{((unref(visibleTags) || [])).map((item) => <ElCheckTag checked={unref(activeTag) == item.key} onClick={($event?: any) => { changeTag(item.key); }} key={item.key}>{item.name}</ElCheckTag>)}{(unref(hiddenTags).length > 0) ? <div class={"more-tag inline"}><ElDropdown v-slots={{ "dropdown": () => <><ElDropdownMenu>{((unref(hiddenTags) || [])).map((item) => <ElDropdownItem onClick={($event?: any) => { changeTag(item.key); }} key={item.key}>{item.name}</ElDropdownItem>)}</ElDropdownMenu></> }}><ElCheckTag checked={unref(moreTag) !== ''}>{unref(moreLabel)}<ElIcon size={10}><ArrowDown /></ElIcon></ElCheckTag></ElDropdown></div> : null}</div>
            <div aria-hidden="true" class={"tag-measurements"}><ElCheckTag ref={allMeasureRef}>{$t('app.all')}</ElCheckTag>{((unref(tags) || [])).map((item) => <ElCheckTag ref={(el) => setMeasureTagRef(item.key, el)} key={`measure-${item.key}`}>{item.name}</ElCheckTag>)}<ElCheckTag ref={moreMeasureRef}>{unref(moreLabel)}<ElIcon size={10}><ArrowDown /></ElIcon></ElCheckTag></div>
            </>
        );
    },
    options,
);
