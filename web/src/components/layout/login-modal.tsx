import { App, Button, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { TwoFactorRequiredError } from "@/services/api/user";
import { useUserStore } from "@/stores/use-user-store";

export function LoginModal() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const open = useUserStore((state) => state.isLoginOpen);
    const redirectPath = useUserStore((state) => state.loginRedirectPath);
    const closeLoginModal = useUserStore((state) => state.closeLoginModal);
    const login = useUserStore((state) => state.login);
    const register = useUserStore((state) => state.register);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [totp, setTotp] = useState("");
    const [need2fa, setNeed2fa] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        setPassword("");
        setConfirmPassword("");
        setTotp("");
        setNeed2fa(false);
    };

    const finish = async (action: () => Promise<unknown>) => {
        setSubmitting(true);
        try {
            await action();
            message.success(t(mode === "register" ? "login.registerSuccess" : "login.success"));
            resetForm();
            navigate(redirectPath || "/canvas");
        } catch (error) {
            if (error instanceof TwoFactorRequiredError) {
                setNeed2fa(true);
                message.info(t("login.twoFactorRequired"));
                return;
            }
            message.error(error instanceof Error ? error.message : t(mode === "register" ? "login.registerFailed" : "login.failed"));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!username.trim() || !password) {
            message.error(t("login.required"));
            return;
        }
        if (mode === "register") {
            if (password.length < 8 || password.length > 20) {
                message.error(t("login.passwordLength"));
                return;
            }
            if (password !== confirmPassword) {
                message.error(t("login.passwordMismatch"));
                return;
            }
            await finish(() => register(username, password));
            return;
        }
        if (need2fa && !totp.trim()) {
            message.error(t("login.twoFactorRequired"));
            return;
        }
        await finish(() => login(username, password, need2fa ? totp : undefined));
    };

    return (
        <Modal
            title={t(mode === "register" ? "login.registerTitle" : "login.title")}
            open={open}
            onCancel={() => {
                resetForm();
                setMode("login");
                closeLoginModal();
            }}
            footer={null}
            centered
            destroyOnHidden
        >
            <Form layout="vertical" requiredMark={false} onFinish={() => void handleSubmit()}>
                <Form.Item label={t("login.username")} required>
                    <Input value={username} autoComplete="username" placeholder={t("login.usernamePlaceholder")} disabled={need2fa} onChange={(event) => setUsername(event.target.value)} />
                </Form.Item>
                {need2fa ? (
                    <Form.Item label={t("login.twoFactor")} required>
                        <Input value={totp} autoComplete="one-time-code" placeholder={t("login.twoFactorPlaceholder")} onChange={(event) => setTotp(event.target.value)} />
                    </Form.Item>
                ) : (
                    <>
                        <Form.Item label={t("login.password")} required>
                            <Input.Password value={password} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder={t("login.passwordPlaceholder")} onChange={(event) => setPassword(event.target.value)} />
                        </Form.Item>
                        {mode === "register" ? (
                            <Form.Item label={t("login.confirmPassword")} required>
                                <Input.Password value={confirmPassword} autoComplete="new-password" placeholder={t("login.confirmPasswordPlaceholder")} onChange={(event) => setConfirmPassword(event.target.value)} />
                            </Form.Item>
                        ) : null}
                    </>
                )}
                <Button type="primary" htmlType="submit" block loading={submitting}>
                    {t(need2fa ? "login.submit" : mode === "register" ? "login.registerSubmit" : "login.submit")}
                </Button>
                {!need2fa ? (
                    <Button
                        type="link"
                        block
                        className="mt-2"
                        onClick={() => {
                            resetForm();
                            setMode(mode === "login" ? "register" : "login");
                        }}
                    >
                        {t(mode === "login" ? "login.goRegister" : "login.goLogin")}
                    </Button>
                ) : null}
            </Form>
        </Modal>
    );
}
