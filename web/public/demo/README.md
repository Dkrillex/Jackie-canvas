# public/demo — 演示用素材

放**可以直接用 URL 引用**的演示图片/视频。这里的文件由 Vite 原样发布，路径就是站内地址：

| 文件 | URL |
| --- | --- |
| `job-demo.jpg` | `/demo/job-demo.jpg` |

主要用途是测试接单中心的图片链路。接单中心的需求说明和交付说明都是 Markdown，
**用 URL 插入的图片所有人都能看到**（文本存在服务端，图片从地址拉），而编辑器里
「插入图片」上传的图只写进发布者自己的浏览器（`image:<key>` + IndexedDB），别人打开
会看到 `[Image blocked: …]`。所以要验证「外部能不能正常显示」，用这里的 URL：

```markdown
![demo](/demo/job-demo.jpg)
```
