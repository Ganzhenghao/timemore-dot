/** 冲煮计划列表 store */
import { ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '../api/client';
import { useToastStore } from './toast';
export const usePlansStore = defineStore('plans', () => {
    const toast = useToastStore();
    const list = ref([]);
    const loaded = ref(false);
    const loading = ref(false);
    async function load() {
        loading.value = true;
        try {
            list.value = await api.planList();
            loaded.value = true;
        }
        catch (e) {
            toast.push(`加载计划失败: ${e.message}`, 'err');
        }
        finally {
            loading.value = false;
        }
    }
    async function save(plan) {
        try {
            await api.planSave(plan);
            await load(); // 列表很小，统一刷新
            toast.push(plan.id ? '计划已更新' : '计划已创建', 'ok');
            return true;
        }
        catch (e) {
            toast.push(e.message, 'err');
            return false;
        }
    }
    async function remove(id) {
        await api.planDelete(id);
        await load();
        toast.push('计划已删除', 'info');
    }
    return { list, loaded, loading, load, save, remove };
});
