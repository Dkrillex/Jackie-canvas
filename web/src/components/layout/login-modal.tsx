import { App, Button, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@/stores/use-locale-store";
import { useUserStore } from "@/stores/use-user-store";

export function LoginModal() {
    const { message } = App.useApp();
    const { t } = useI18n();
    const navigate = useNavigate();
    const open = useUserStore((state) => state.isLoginOpen);
    const redirectPath = useUserStore((state) => state.loginRedirectPath);
    const closeLoginModal = useUserStore((state) => state.closeLoginModal);
    const login = useUserStore((state) => state.login);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!username.trim() || !password) {
            message.error(t("login.required"));
            return;
        }
        setSubmitting(true);
        try {
            await login(username, password);
            message.success(t("login.success"));
            setPassword("");
            navigate(redirectPath || "/image");
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("login.failed"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            title={null}
            open={open}
            onCancel={closeLoginModal}
            footer={null}
            centered
            destroyOnHidden
            width="min(420px, calc(100vw - 32px))"
            className="illucent-login-modal"
        >
            <div className="mb-6 flex flex-col items-center text-center">
                <img src="/logo.svg" alt="Illucent AI" className="h-11 w-11 rounded-xl shadow-[0_10px_28px_-12px_rgba(124,92,252,0.75)]" />
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">{t("login.title")}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t("login.subtitle")}</p>
            </div>
            <Form layout="vertical" requiredMark={false} onFinish={() => void handleSubmit()}>
                <Form.Item label={t("login.username")} required>
                    <Input size="large" value={username} autoComplete="username" placeholder={t("login.usernamePlaceholder")} onChange={(event) => setUsername(event.target.value)} />
                </Form.Item>
                <Form.Item label={t("login.password")} required>
                    <Input.Password size="large" value={password} autoComplete="current-password" placeholder={t("login.passwordPlaceholder")} onChange={(event) => setPassword(event.target.value)} />
                </Form.Item>
                <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                    {t("login.submit")}
                </Button>
            </Form>
        </Modal>
    );
}
