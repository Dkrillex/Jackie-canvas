import { create } from "zustand";

import * as api from "@/jc/services/jobs";
import { useWalletStore } from "@/jc/stores/use-wallet-store";
import type { Job, JobScope } from "@/jc/lib/job-types";

/**
 * 接单中心。工单和积分都在服务端，这里只缓存当前视图的列表。
 *
 * 原来的 client / creator 角色开关没有了：身份由登录账号决定，谁能接受报价、谁能验收
 * 全部由服务端按 userId 判定，前端切什么都改不了权限。`scope` 只是「看哪一批单」的筛选。
 *
 * 每个动作都以「调接口 → 重新拉列表和钱包」结尾，不做本地乐观更新：冻结和结算的结果
 * 只有服务端算得准，本地猜一个再对不上会比慢半秒难受得多。
 */
type JobStore = {
    /** 看哪一批单：大厅 / 我发布的 / 我接的。放在 store 里，从详情页返回时不丢 */
    scope: JobScope;
    /** 当前登录用户的 MaaS userId，用来判断某个单是不是自己的 */
    userId: string;
    jobs: Job[];
    loading: boolean;
    error: string;
    setScope: (scope: JobScope) => void;
    refresh: (scope?: JobScope) => Promise<void>;
    createJob: (input: { title: string; brief: string; budget: number }) => Promise<string>;
    clear: () => void;
};

export const useJobStore = create<JobStore>()((set, get) => {
    /** 动作跑完统一刷新：工单状态和余额都可能变了 */
    const afterAction = async () => {
        await Promise.all([get().refresh(), useWalletStore.getState().refresh()]);
    };

    return {
        scope: "hall",
        userId: "",
        jobs: [],
        loading: false,
        error: "",
        setScope: (scope) => {
            set({ scope });
            void get().refresh(scope);
        },
        refresh: async (scope) => {
            const target = scope || get().scope;
            set({ scope: target, loading: true, error: "" });
            try {
                const { jobs, userId } = await api.listJobs(target);
                set({ jobs, userId, loading: false });
            } catch (error) {
                set({ jobs: [], loading: false, error: error instanceof Error ? error.message : "加载工单失败" });
            }
        },
        createJob: async (input) => {
            const { id } = await api.createJob(input);
            await afterAction();
            return id;
        },
        clear: () => set({ jobs: [], userId: "", error: "" }),
    };
});
