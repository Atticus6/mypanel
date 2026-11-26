import { GlobalStore } from '@/store';
import { storeToRefs } from 'pinia';
import type { GlobalState } from '@/store/interface';

type GlobalGetterKey =
    | 'isDarkTheme'
    | 'isDarkGoldTheme'
    | 'isNodeAdmin'
    | 'isAdminOrNodeAdmin'
    | 'docsUrl'
    | 'isMaster'
    | 'isMobile'
    | 'isXpackOrEE'
    | 'isEE'
    | 'isMasterPro';

type GlobalGetterRefs = Record<GlobalGetterKey, ComputedRef<any>>;

export const useGlobalStore = () => {
    const globalStore = GlobalStore();
    const storeRefs = storeToRefs(globalStore) as ReturnType<typeof storeToRefs> &
        ToRefs<GlobalState> &
        GlobalGetterRefs;

    return {
        globalStore,
        ...storeRefs,
    };
};
