import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';
import { useDeviceStore } from '../stores/device';
import { useToastStore } from '../stores/toast';
import ConfirmDialog from '../components/ConfirmDialog.vue';
const device = useDeviceStore();
const toast = useToastStore();
// ── 数据库 ───────────────────────────────────────────────────────────
const dbType = ref('sqlite');
const dbSqliteFile = ref('');
const mysqlForm = reactive({ host: '127.0.0.1', port: 3306, user: '', password: '', database: '' });
const testing = ref(false);
const saving = ref(false);
onMounted(async () => {
    try {
        const cfg = await api.databaseCurrent();
        dbType.value = cfg.type;
        dbSqliteFile.value = cfg.sqlite.file;
        if (cfg.mysql)
            Object.assign(mysqlForm, cfg.mysql);
    }
    catch (e) {
        toast.push(`读取配置失败: ${e.message}`, 'err');
    }
});
function buildPayload() {
    if (dbType.value === 'sqlite')
        return { type: 'sqlite' };
    return { type: 'mysql', mysql: { ...mysqlForm } };
}
async function testConnection() {
    testing.value = true;
    try {
        await api.databaseTest(buildPayload());
        toast.push('连接成功', 'ok');
    }
    catch (e) {
        toast.push(e.message, 'err');
    }
    finally {
        testing.value = false;
    }
}
async function saveDb() {
    saving.value = true;
    try {
        await api.databaseSave(buildPayload());
        toast.push(`已切换到 ${dbType.value === 'mysql' ? 'MySQL' : 'SQLite'}，后续数据将存入新位置`, 'ok');
    }
    catch (e) {
        toast.push(e.message, 'err');
    }
    finally {
        saving.value = false;
    }
}
// ── 设备工具 ─────────────────────────────────────────────────────────
const powerOffConfirm = ref(false);
async function confirmPowerOff() {
    try {
        const ok = await device.ensureScale().powerOff();
        toast.push(ok ? '关机指令已发送' : '关机指令未确认（秤可能已断开）', ok ? 'ok' : 'warn');
    }
    catch (e) {
        toast.push(`发送失败: ${e.message}`, 'err');
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['type-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sqlite-info']} */ ;
/** @type {__VLS_StyleScopedClasses['sqlite-info']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-info']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-info']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "settings" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
    'aria-labelledby': "db-title",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    id: "db-title",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "card-desc" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "db-type" },
    role: "radiogroup",
    'aria-label': "数据库类型",
});
for (const [t] of __VLS_getVForSourceType(['sqlite', 'mysql'])) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.dbType = t;
            } },
        key: (t),
        type: "button",
        role: "radio",
        'aria-checked': (__VLS_ctx.dbType === t),
        ...{ class: "type-btn" },
        ...{ class: ({ active: __VLS_ctx.dbType === t }) },
    });
    (t === 'sqlite' ? 'SQLite（默认）' : 'MySQL');
}
if (__VLS_ctx.dbType === 'sqlite') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "sqlite-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "k" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.code, __VLS_intrinsicElements.code)({
        ...{ class: "v" },
    });
    (__VLS_ctx.dbSqliteFile);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.form, __VLS_intrinsicElements.form)({
        ...{ onSubmit: (__VLS_ctx.saveDb) },
        ...{ class: "mysql-form" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "my-host",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "my-host",
        name: "my-host",
        required: true,
    });
    (__VLS_ctx.mysqlForm.host);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "my-port",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "my-port",
        value: (__VLS_ctx.mysqlForm.port),
        name: "my-port",
        type: "text",
        inputmode: "numeric",
        required: true,
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "my-user",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "my-user",
        name: "my-user",
        autocomplete: "off",
        required: true,
    });
    (__VLS_ctx.mysqlForm.user);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "my-pass",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "my-pass",
        name: "my-pass",
        type: "password",
        autocomplete: "off",
    });
    (__VLS_ctx.mysqlForm.password);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "field" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({
        for: "my-db",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        id: "my-db",
        name: "my-db",
        required: true,
    });
    (__VLS_ctx.mysqlForm.database);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "hint-inline" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.dbType === 'sqlite'))
                    return;
                __VLS_ctx.testConnection();
            } },
        ...{ class: "btn" },
        type: "button",
        disabled: (__VLS_ctx.testing),
    });
    (__VLS_ctx.testing ? '测试中…' : '测试连接');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ class: "btn primary" },
        type: "submit",
        disabled: (__VLS_ctx.saving),
    });
    (__VLS_ctx.saving ? '切换中…' : '保存并切换');
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
    'aria-labelledby': "dev-title",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    id: "dev-title",
});
if (__VLS_ctx.device.isConnected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dl, __VLS_intrinsicElements.dl)({
        ...{ class: "dev-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dt, __VLS_intrinsicElements.dt)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dd, __VLS_intrinsicElements.dd)({});
    (__VLS_ctx.device.deviceInfo.scaleName || __VLS_ctx.device.deviceInfo.bleName || '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dt, __VLS_intrinsicElements.dt)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dd, __VLS_intrinsicElements.dd)({});
    (__VLS_ctx.device.deviceInfo.modelNumber || '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dt, __VLS_intrinsicElements.dt)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dd, __VLS_intrinsicElements.dd)({});
    (__VLS_ctx.device.deviceInfo.firmware || '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dt, __VLS_intrinsicElements.dt)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dd, __VLS_intrinsicElements.dd)({});
    (__VLS_ctx.device.deviceInfo.manufacturer || '—');
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dt, __VLS_intrinsicElements.dt)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.dd, __VLS_intrinsicElements.dd)({
        ...{ class: "num" },
    });
    (__VLS_ctx.device.batteryPercent);
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "card-desc" },
    });
}
if (__VLS_ctx.device.deviceInfo.modelMismatch) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "warn-tip" },
    });
    (__VLS_ctx.device.deviceInfo.modelNumber);
}
if (__VLS_ctx.device.isConnected) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "actions" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.device.reconnect();
            } },
        ...{ class: "btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.device.disconnect();
            } },
        ...{ class: "btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.device.isConnected))
                    return;
                __VLS_ctx.powerOffConfirm = true;
            } },
        ...{ class: "btn danger" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "card" },
    'aria-labelledby': "about-title",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
    id: "about-title",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "card-desc" },
});
/** @type {[typeof ConfirmDialog, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(ConfirmDialog, new ConfirmDialog({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.powerOffConfirm),
    title: "关闭电子秤？",
    message: "将发送关机指令，秤会进入关机/休眠状态，可随时通过秤上的按键重新开机。",
    confirmText: "关机",
    danger: true,
}));
const __VLS_1 = __VLS_0({
    ...{ 'onConfirm': {} },
    open: (__VLS_ctx.powerOffConfirm),
    title: "关闭电子秤？",
    message: "将发送关机指令，秤会进入关机/休眠状态，可随时通过秤上的按键重新开机。",
    confirmText: "关机",
    danger: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
let __VLS_3;
let __VLS_4;
let __VLS_5;
const __VLS_6 = {
    onConfirm: (__VLS_ctx.confirmPowerOff)
};
var __VLS_2;
/** @type {__VLS_StyleScopedClasses['settings']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['db-type']} */ ;
/** @type {__VLS_StyleScopedClasses['type-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['sqlite-info']} */ ;
/** @type {__VLS_StyleScopedClasses['k']} */ ;
/** @type {__VLS_StyleScopedClasses['v']} */ ;
/** @type {__VLS_StyleScopedClasses['mysql-form']} */ ;
/** @type {__VLS_StyleScopedClasses['field-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field-row']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['field']} */ ;
/** @type {__VLS_StyleScopedClasses['hint-inline']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['dev-info']} */ ;
/** @type {__VLS_StyleScopedClasses['num']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
/** @type {__VLS_StyleScopedClasses['warn-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['danger']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-desc']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ConfirmDialog: ConfirmDialog,
            device: device,
            dbType: dbType,
            dbSqliteFile: dbSqliteFile,
            mysqlForm: mysqlForm,
            testing: testing,
            saving: saving,
            testConnection: testConnection,
            saveDb: saveDb,
            powerOffConfirm: powerOffConfirm,
            confirmPowerOff: confirmPowerOff,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
