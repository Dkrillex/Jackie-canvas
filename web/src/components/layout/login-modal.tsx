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
        <Modal title={t("login.title")} open={open} onCancel={closeLoginModal} footer={null} centered destroyOnHidden width="min(420px, calc(100vw - 32px))">
            <Form layout="vertical" requiredMark={false} onFinish={() => void handleSubmit()}>
                <Form.Item label={t("login.username")} required>
                    <Input value={username} autoComplete="username" placeholder={t("login.usernamePlaceholder")} onChange={(event) => setUsername(event.target.value)} />
                </Form.Item>
                <Form.Item label={t("login.password")} required>
                    <Input.Password value={password} autoComplete="current-password" placeholder={t("login.passwordPlaceholder")} onChange={(event) => setPassword(event.target.value)} />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={submitting}>
                    {t("login.submit")}
                </Button>
            </Form>
        </Modal>
    );
}
