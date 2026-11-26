import LayoutContent from './layout-content/index';
import RouterButton from './router-button/index';
import ComplexTable from './table/complex/ComplexTable';
import OpDialog from './del-dialog/index';
import CopyButton from '@/components/copy-button/index';
import MsgInfo from '@/components/msg-info/index';
import DrawerPro from '@/components/drawer-pro/index';
import DialogPro from '@/components/dialog-pro/index';
import FuDropdownItem from '@/components/fu/FuDropdownItem';
import FuInputRwSwitch from '@/components/fu/FuInputRwSwitch';
import FuReadWriteSwitch from '@/components/fu/FuReadWriteSwitch';
import FuSelectRwSwitch from '@/components/fu/FuSelectRwSwitch';
import FuStep from '@/components/fu/FuStep';
import FuSteps from '@/components/fu/FuSteps';
import TableComponents from '@/components/table';
export default {
    install(app: App) {
        app.use(TableComponents);
        app.component(LayoutContent.name, LayoutContent);
        app.component(RouterButton.name, RouterButton);
        app.component(ComplexTable.name, ComplexTable);
        app.component(OpDialog.name, OpDialog);
        app.component(CopyButton.name, CopyButton);
        app.component(MsgInfo.name, MsgInfo);
        app.component(DrawerPro.name, DrawerPro);
        app.component(DialogPro.name, DialogPro);
        [FuDropdownItem, FuInputRwSwitch, FuReadWriteSwitch, FuSelectRwSwitch, FuSteps, FuStep].forEach((component) => {
            app.component((component as any).name, component as any);
        });
    },
};
