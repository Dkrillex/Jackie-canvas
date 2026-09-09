import { Copy, KeyRound, Pencil, Shield, Trash2, User, Wallet } from "lucide-react";
import { Alert, App, Button, Form, Input, InputNumber, Modal, Popconfirm, Switch, Table, Tag, Tooltip } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ENTERPRISE_ADMIN, addMember, allocateQuota, deleteMember, editMember, type EnterpriseMember } from "@/jc/services/enterprise";
import { useCopyText } from "@/hooks/use-copy-text";
import { useEnterpriseStore } from "@/jc/stores/use-enterprise-store";

const usd = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

export function MembersTab({ isAdmin, myQuotaUsd, currentUserId, addOpen, onCloseAdd }: { isAdmin: boolean; myQuotaUsd: number; currentUserId?: string; addOpen: boolean; onCloseAdd: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const members = useEnterpriseStore((s) => s.members);
    const loading = useEnterpriseStore((s) => s.loading);
    const refresh = useEnterpriseStore((s) => s.refresh);

    const [editing, setEditing] = useState<EnterpriseMember | null>(null);
    const [allocating, setAllocating] = useState<EnterpriseMember | null>(null);

    return (
        <>
            {/* 普通成员这里只会拿到自己那一行，服务端过滤的 */}
            <Table<EnterpriseMember>
                rowKey="id"
                size="small"
                loading={loading}
                dataSource={members}
                pagination={{ pageSize: 10, hideOnSinglePage: true }}
                scroll={{ x: 720 }}
                columns={[
                    {
                        title: t("enterprise.colAccount"),
                        dataIndex: "userName",
                        render: (userName: string, row) => (
                            <span className="font-medium">
                                {userName}
                                {row.userId === currentUserId ? <span className="ml-1.5 text-xs font-normal text-stone-400">{t("enterprise.you")}</span> : null}
                            </span>
                        ),
                    },
                    { title: t("enterprise.colNickName"), dataIndex: "nickName" },
                    {
                        title: t("enterprise.colRole"),
                        dataIndex: "userType",
                        width: 110,
                        render: (userType: number) => (
                            <Tag icon={userType === ENTERPRISE_ADMIN ? <Shield className="mr-1 inline size-3" /> : <User className="mr-1 inline size-3" />} color={userType === ENTERPRISE_ADMIN ? "geekblue" : "default"}>
                                {t(userType === ENTERPRISE_ADMIN ? "enterprise.roleAdmin" : "enterprise.roleMember")}
                            </Tag>
                        ),
                    },
                    { title: t("enterprise.colQuota"), dataIndex: "quotaUsd", width: 110, align: "right", render: (value: number) => <span className="font-medium tabular-nums">{usd(value)}</span> },
                    { title: t("enterprise.colUsed"), dataIndex: "usedQuotaUsd", width: 110, align: "right", render: (value: number) => <span className="tabular-nums text-stone-500">{usd(value)}</span> },
                    {
                        title: t("enterprise.colStatus"),
                        dataIndex: "status",
                        width: 90,
                        // 列表里的 status 是企业成员表的约定：1=启用
                        render: (status: number) => <Tag color={status === 1 ? "success" : "error"}>{t(status === 1 ? "enterprise.statusEnabled" : "enterprise.statusDisabled")}</Tag>,
                    },
                    { title: t("enterprise.colJoinedAt"), dataIndex: "createTime", width: 170, render: (value?: string) => <span className="tabular-nums text-stone-500">{value ? value.slice(0, 16) : "—"}</span> },
                    ...(isAdmin
                        ? [
                              {
                                  title: t("enterprise.colAction"),
                                  width: 120,
                                  fixed: "right" as const,
                                  render: (_: unknown, row: EnterpriseMember) => (
                                      <div className="flex items-center gap-1">
                                          {/* 服务端明确禁止「编辑自己」，按钮也别给 */}
                                          {row.userId === currentUserId ? null : (
                                              <Tooltip title={t("enterprise.edit")}>
                                                  <Button type="text" size="small" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(row)} />
                                              </Tooltip>
                                          )}
                                          {row.userType === ENTERPRISE_ADMIN ? null : (
                                              <>
                                                  <Tooltip title={t("enterprise.allocate")}>
                                                      <Button type="text" size="small" icon={<Wallet className="size-3.5" />} onClick={() => setAllocating(row)} />
                                                  </Tooltip>
                                                  <Popconfirm
                                                      title={t("enterprise.deleteConfirm", { name: row.userName })}
                                                      okButtonProps={{ danger: true }}
                                                      onConfirm={async () => {
                                                          try {
                                                              await deleteMember(row.userId);
                                                              await refresh();
                                                              message.success(t("enterprise.deleted"));
                                                          } catch (err) {
                                                              message.error(err instanceof Error ? err.message : t("enterprise.actionFailed"));
                                                          }
                                                      }}
                                                  >
                                                      <Tooltip title={t("enterprise.delete")}>
                                                          <Button type="text" size="small" danger icon={<Trash2 className="size-3.5" />} />
                                                      </Tooltip>
                                                  </Popconfirm>
                                              </>
                                          )}
                                      </div>
                                  ),
                              },
                          ]
                        : []),
                ]}
            />

            <AddMemberModal open={addOpen} onClose={onCloseAdd} myQuotaUsd={myQuotaUsd} />
            <EditMemberModal member={editing} onClose={() => setEditing(null)} />
            <AllocateQuotaModal member={allocating} onClose={() => setAllocating(null)} myQuotaUsd={myQuotaUsd} />
        </>
    );
}

/** 生成一个满足服务端 6~20 位要求的初始密码。管理员通常不想自己想密码。 */
function randomPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
}

function AddMemberModal({ open, onClose, myQuotaUsd }: { open: boolean; onClose: () => void; myQuotaUsd: number }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const copyText = useCopyText();
    const refresh = useEnterpriseStore((s) => s.refresh);
    const [form] = Form.useForm<{ userName: string; nickName: string; password: string; email?: string; phonenumber?: string; initialBalanceUsd?: number }>();
    const [busy, setBusy] = useState(false);
    /** 建好的账号密码只在这一次响应里出现，服务端不会再给第二次，所以建完先摊在页面上让人抄走 */
    const [created, setCreated] = useState<{ userName: string; password: string } | null>(null);

    const close = () => {
        onClose();
        form.resetFields();
        setCreated(null);
    };

    const submit = async () => {
        const values = await form.validateFields();
        setBusy(true);
        try {
            const result = await addMember({ ...values, initialBalanceUsd: values.initialBalanceUsd || 0 });
            setCreated({ userName: result.userName || values.userName, password: result.password || values.password });
            await refresh();
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("enterprise.actionFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={close}
            title={t("enterprise.addMember")}
            width={560}
            destroyOnHidden
            afterOpenChange={(opened) => opened && form.setFieldValue("password", randomPassword())}
            footer={
                created ? (
                    <div className="flex items-center justify-end gap-2">
                        {/* 交接的时候是把账号密码一起发给对方的，分两次复制等于逼人去拼一遍 */}
                        <Button icon={<Copy className="size-3.5" />} onClick={() => copyText(t("enterprise.credentialsCopy", { userName: created.userName, password: created.password }))}>
                            {t("enterprise.copyBoth")}
                        </Button>
                        <Button type="primary" onClick={close}>
                            {t("common.done")}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-end gap-2">
                        <Button onClick={close}>{t("common.cancel")}</Button>
                        <Button type="primary" loading={busy} onClick={() => void submit()}>
                            {t("enterprise.addMember")}
                        </Button>
                    </div>
                )
            }
        >
            {created ? (
                <div className="space-y-3 py-2">
                    <Alert type="warning" showIcon message={t("enterprise.createdWarn")} />
                    {[
                        { label: t("enterprise.fieldAccount"), value: created.userName },
                        { label: t("enterprise.fieldPassword"), value: created.password },
                    ].map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 px-3 py-2.5 dark:border-stone-800">
                            <span className="text-xs text-stone-500">{row.label}</span>
                            <span className="flex items-center gap-2">
                                <span className="font-mono text-sm">{row.value}</span>
                                <Button type="text" size="small" icon={<Copy className="size-3.5" />} onClick={() => copyText(row.value)} />
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <Form form={form} layout="vertical" requiredMark={false} initialValues={{ initialBalanceUsd: 0 }} className="pt-1">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Form.Item name="userName" label={t("enterprise.fieldAccount")} rules={[{ required: true }, { min: 2, max: 30 }]} className="!mb-0">
                            <Input autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="nickName" label={t("enterprise.fieldNickName")} rules={[{ required: true }, { max: 30 }]} className="!mb-0">
                            <Input />
                        </Form.Item>
                    </div>
                    <Form.Item name="password" label={t("enterprise.fieldPassword")} rules={[{ required: true }, { min: 6, max: 20 }]} extra={t("enterprise.passwordHint")} className="!mb-0 mt-4">
                        <Input
                            autoComplete="off"
                            addonAfter={
                                <Tooltip title={t("enterprise.regenerate")}>
                                    <KeyRound className="size-3.5 cursor-pointer" onClick={() => form.setFieldValue("password", randomPassword())} />
                                </Tooltip>
                            }
                        />
                    </Form.Item>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Form.Item name="email" label={t("enterprise.fieldEmail")} rules={[{ type: "email" }]} className="!mb-0">
                            <Input autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="phonenumber" label={t("enterprise.fieldPhone")} rules={[{ max: 11 }]} className="!mb-0">
                            <Input autoComplete="off" />
                        </Form.Item>
                    </div>
                    <Form.Item
                        name="initialBalanceUsd"
                        label={t("enterprise.fieldInitialBalance")}
                        // 这笔钱是从管理员自己的额度里划的，不写清楚会以为是平台送的
                        extra={t("enterprise.initialBalanceHint", { amount: usd(myQuotaUsd) })}
                        rules={[{ type: "number", min: 0, max: myQuotaUsd }]}
                        className="!mb-0 mt-4"
                    >
                        <InputNumber min={0} max={myQuotaUsd} step={1} precision={2} className="w-full" addonBefore="$" />
                    </Form.Item>
                </Form>
            )}
        </Modal>
    );
}

function EditMemberModal({ member, onClose }: { member: EnterpriseMember | null; onClose: () => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const refresh = useEnterpriseStore((s) => s.refresh);
    const [form] = Form.useForm<{ userName: string; nickName: string; enabled: boolean; newPassword?: string }>();
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!member) return;
        const values = await form.validateFields();
        setBusy(true);
        try {
            await editMember(member.userId, {
                userName: values.userName?.trim() || undefined,
                nickName: values.nickName?.trim() || undefined,
                newPassword: values.newPassword?.trim() || undefined,
                enabled: values.enabled,
            });
            await refresh();
            message.success(t("enterprise.saved"));
            onClose();
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("enterprise.actionFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal open={Boolean(member)} onCancel={onClose} onOk={() => void submit()} confirmLoading={busy} okText={t("common.save")} cancelText={t("common.cancel")} title={t("enterprise.editMember")} width={480} destroyOnHidden>
            {member ? (
                <Form
                    form={form}
                    layout="vertical"
                    requiredMark={false}
                    // 列表里的 status 是 1=启用，这里统一换成布尔量，发请求时再转回接口的约定
                    initialValues={{ userName: member.userName, nickName: member.nickName, enabled: member.status === 1, newPassword: "" }}
                    className="pt-1"
                >
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Form.Item name="userName" label={t("enterprise.fieldAccount")} rules={[{ min: 2, max: 30 }]} className="!mb-0">
                            <Input autoComplete="off" />
                        </Form.Item>
                        <Form.Item name="nickName" label={t("enterprise.fieldNickName")} rules={[{ max: 30 }]} className="!mb-0">
                            <Input />
                        </Form.Item>
                    </div>
                    <Form.Item name="newPassword" label={t("enterprise.fieldNewPassword")} rules={[{ min: 6, max: 20 }]} extra={t("enterprise.newPasswordHint")} className="!mb-0 mt-4">
                        <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item name="enabled" label={t("enterprise.fieldStatus")} valuePropName="checked" extra={t("enterprise.statusHint")} className="!mb-0 mt-4">
                        <Switch checkedChildren={t("enterprise.statusEnabled")} unCheckedChildren={t("enterprise.statusDisabled")} />
                    </Form.Item>
                </Form>
            ) : null}
        </Modal>
    );
}

function AllocateQuotaModal({ member, onClose, myQuotaUsd }: { member: EnterpriseMember | null; onClose: () => void; myQuotaUsd: number }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const refresh = useEnterpriseStore((s) => s.refresh);
    const [amount, setAmount] = useState<number | null>(1);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!member || !amount) return;
        setBusy(true);
        try {
            await allocateQuota(member.userId, amount);
            await refresh();
            message.success(t("enterprise.allocated"));
            onClose();
        } catch (err) {
            message.error(err instanceof Error ? err.message : t("enterprise.actionFailed"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={Boolean(member)}
            onCancel={onClose}
            onOk={() => void submit()}
            confirmLoading={busy}
            okButtonProps={{ disabled: !amount || amount > myQuotaUsd }}
            okText={t("enterprise.allocate")}
            cancelText={t("common.cancel")}
            title={t("enterprise.allocate")}
            width={420}
            destroyOnHidden
        >
            {member ? (
                <div className="space-y-3 py-1">
                    <div className="text-sm text-stone-500 dark:text-stone-400">{t("enterprise.allocateHint", { name: member.nickName || member.userName, amount: usd(myQuotaUsd) })}</div>
                    {/* 上限是管理员自己的剩余额度：多划的话服务端会拒，先在前端拦住 */}
                    <InputNumber min={0.01} max={myQuotaUsd} step={1} precision={2} value={amount} onChange={setAmount} className="w-full" addonBefore="$" />
                    <div className="flex items-center justify-between text-xs text-stone-400">
                        <span>{t("enterprise.memberQuotaNow", { amount: usd(member.quotaUsd) })}</span>
                        <span className="tabular-nums">{t("enterprise.afterAllocate", { amount: usd(member.quotaUsd + (amount || 0)) })}</span>
                    </div>
                </div>
            ) : null}
        </Modal>
    );
}
