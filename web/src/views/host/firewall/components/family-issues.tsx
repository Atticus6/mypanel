import { $t } from '@/utils/i18n-t';
import { ref } from 'vue';
import { WarningFilled } from '@element-plus/icons-vue';
import { Firewall } from '@/types/firewall';
import TaskLog from '@/components/log/task/index';
import { MsgSuccess } from '@/utils/message';
import i18n from '@/lang';
import { rpc } from '@/lib/rpc';
interface FamilyIssue {
    family: 'ipv4' | 'ipv6';
    message: string;
    helpUrl?: string;
    action?: 'initialize' | 'repair' | 'bind';
}
import './family-issues.styles.css';
import { defineComponent, Fragment, unref, withDirectives } from 'vue';
import { type VNode, type SlotsType, type ComponentObjectPropsOptions } from 'vue';
import permissionDirective from '@/directives/modules/permission';
import { nodeAdminDirective } from '@/directives/modules/permission';
import { ElPopover } from 'element-plus';
import { ElButton } from 'element-plus';
import { ElIcon } from 'element-plus';
import { ElTag } from 'element-plus';
import { ElLink } from 'element-plus';

interface CodemodProps {
    [key: string]: any;
    subsystem?: Firewall.BackendSubsystem;
    backend?: Firewall.Provider;
    issues?: FamilyIssue[];
    disabled?: boolean;
}

const emits = {
    complete: () => true,
};

const options = {
    name: 'family-issues',
    props: {
        subsystem: { type: null },
        backend: { type: null },
        issues: Array,
        disabled: Boolean,
    } as unknown as ComponentObjectPropsOptions<CodemodProps>,
    emits: emits,
    __scopeId: 'data-v-0c3a0454',
};

export default defineComponent<CodemodProps, typeof emits, keyof typeof emits, Record<string, never>>(
    (__panelSetupProps, ctx) => {
        const running = ref('');
        const taskLogRef = ref<InstanceType<typeof TaskLog>>();
        const complete = () => {
            running.value = '';
            ctx.emit('complete');
        };
        const operate = async (issue: FamilyIssue) => {
            if (running.value || __panelSetupProps.disabled || !issue.action) return;
            running.value = issue.family;
            try {
                const result = await rpc.firewall.operateFamily({
                    subsystem: __panelSetupProps.subsystem,
                    backend: __panelSetupProps.backend,
                    family: issue.family,
                    operation: issue.action,
                });
                if (result.queued && result.taskId) {
                    taskLogRef.value?.openWithTaskID(result.taskId, true);
                } else {
                    MsgSuccess(i18n.global.t('commons.msg.operationSuccess'));
                    complete();
                }
            } catch (error) {
                complete();
                throw error;
            }
        };
        return () => (
            <>
                {__panelSetupProps.issues.length ? (
                    <ElPopover
                        placement="bottom-start"
                        trigger="click"
                        width={360}
                        popper-options={{ modifiers: [{ name: 'preventOverflow', options: { padding: 16 } }] }}
                        popper-class="firewall-family-popover"
                        v-slots={{
                            reference: () => (
                                <>
                                    <ElButton text aria-label={$t('commons.msg.infoTitle')} class={'family-warning'}>
                                        <ElIcon>
                                            <WarningFilled />
                                        </ElIcon>
                                    </ElButton>
                                </>
                            ),
                        }}
                    >
                        {(__panelSetupProps.issues || []).map((issue) => (
                            <div class={'family-row'} key={issue.family}>
                                <div class={'family-row__body'}>
                                    <ElTag size="small" type="info" effect="plain">
                                        {issue.family === 'ipv6' ? 'IPv6' : 'IPv4'}
                                    </ElTag>
                                    <p>
                                        {issue.message}
                                        {issue.helpUrl ? (
                                            <ElLink
                                                type="primary"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                href={issue.helpUrl}
                                                class={'ml-1 text-xs'}
                                            >
                                                {$t('commons.button.helpDoc')}
                                            </ElLink>
                                        ) : null}
                                    </p>
                                </div>
                                {issue.action
                                    ? withDirectives(
                                          <ElButton
                                              size="small"
                                              type="primary"
                                              plain
                                              loading={unref(running) === issue.family}
                                              disabled={
                                                  __panelSetupProps.disabled ||
                                                  (!!unref(running) && unref(running) !== issue.family)
                                              }
                                              onClick={($event?: any) => {
                                                  operate(issue);
                                              }}
                                          >
                                              {$t(
                                                  issue.action === 'bind'
                                                      ? 'commons.button.bind'
                                                      : issue.action === 'repair'
                                                        ? 'firewall.familyRepair'
                                                        : 'commons.button.init',
                                              )}
                                          </ElButton>,
                                          [
                                              [permissionDirective, true],
                                              [nodeAdminDirective, true],
                                          ],
                                      )
                                    : null}
                            </div>
                        ))}
                    </ElPopover>
                ) : null}
                <TaskLog
                    ref={taskLogRef}
                    onClose={($event?: any) => {
                        (complete as any)($event);
                    }}
                />
            </>
        );
    },
    options,
);
