/** codemod 在转换过程中使用的中间数据结构。 */

export interface PropInfo {
    name: string;
    tsType: string;
    runtime: string;
    optional: boolean;
}

export interface ScriptInfo {
    /** 去掉编译宏后的 setup 函数体（已包含 ctx.expose）。 */
    body: string;
    /** 组件的 Props 接口文本。 */
    propsInterface: string;
    /** 运行时 props 选项文本。 */
    propsOption: string;
    /** emits 对象定义文本。 */
    emitsObject: string;
    /** 是否为数组形式的 emits（payload 无类型）。 */
    emitsUntyped: boolean;
    /** 插槽原始形状文本（不含 SlotsType 包裹）。 */
    slotsShape: string;
    /** defineOptions 中的 name。 */
    name: string;
    /** 其它 defineOptions 字段文本。 */
    extraOptions: string;
    /** 顶层 import 与 type 声明文本。 */
    header: string;
    /** 在模板表达式中需要自动解包（.value / unref）的标识符。 */
    refNames: Set<string>;
    /** Props 字段名，模板里裸写时需要补 props. 前缀。 */
    propNames: Set<string>;
    /** 脚本中显式 import 的标识符，PascalCase 组件标签需保留原名。 */
    componentImports: Set<string>;
    /** defineProps 赋值的局部变量名，模板里需映射回 props。 */
    propsVar: string;
    /** defineEmits 赋值的局部变量名，模板里需映射回 ctx.emit。 */
    emitsVar: string;
    /** 生成的 setup 形参名；与脚本中已有 __props 变量冲突时改名。 */
    paramName: string;
    /** 是否是纯模板型（无内部状态），可用 FunctionalComponent。 */
    stateless: boolean;
    /** defineModel 变量名到其类型的映射。 */
    models: Map<string, string>;
    /** defineExpose 要暴露的对象文本。 */
    exposeObject: string;
}
