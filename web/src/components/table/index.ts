import FuTable from './Table';
import FuTableColumnSelect from './TableColumnSelect';
import FuTableOperations from './TableOperations';
import FuTablePagination from './TablePagination';
import TableRefresh from './TableRefresh';
import TableSearch from './TableSearch';
import TableSetting from './TableSetting';
import TableViewSwitch from './TableViewSwitch';

const components = [
    FuTable,
    FuTableOperations,
    FuTablePagination,
    FuTableColumnSelect,
    TableSearch,
    TableSetting,
    TableRefresh,
    TableViewSwitch,
];

export default {
    install(app: App) {
        components.forEach((component) => {
            app.component((component as any).name, component as any);
        });
    },
};
