import { App, Button, Form, Input, Modal } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useUserStore } from "@/stores/use-user-store";

export function LoginModal() {
    const { message } = App.useApp();
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
            message.error("请输入用户名和密码");
            return;
        }
        setSubmitting(true);
        try {
            await login(username, password);
            message.success("登录成功");
            setPassword("");
            navigate(redirectPath || "/image");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "登录失败");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal title="登录 MPTECH AI" open={open} onCancel={closeLoginModal} footer={null} centered destroyOnHidden>
            <Form layout="vertical" requiredMark={false} onFinish={() => void handleSubmit()}>
                <Form.Item label="用户名" required>
                    <Input value={username} autoComplete="username" placeholder="请输入用户名" onChange={(event) => setUsername(event.target.value)} />
                </Form.Item>
                <Form.Item label="密码" required>
                    <Input.Password value={password} autoComplete="current-password" placeholder="请输入密码" onChange={(event) => setPassword(event.target.value)} />
                </Form.Item>
                <Button type="primary" htmlType="submit" block loading={submitting}>
                    登录
                </Button>
            </Form>
        </Modal>
    );
}
