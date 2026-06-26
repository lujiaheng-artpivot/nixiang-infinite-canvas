# 拟像 无限画布便携版

这是可直接运行的完整画布，不是视频工程。

左上角品牌区只保留一个“拟像 无限画布”主标题，下方使用 `AI WORKBENCH` 作为功能标签。

## 打开方法

### macOS / Linux / Railway 同款启动

```bash
npm start
```

打开 `http://localhost:4320`。

本地会话会自动创建，打开后可直接进入拟像画布。

### Windows 便携版启动

1. 双击 `启动拟像无限画布.cmd`
2. 等待浏览器打开 `http://localhost:3000`
3. 本地会话自动创建，无需手动输入默认账号。

## Railway 部署

1. 在 Railway 新建 Project，选择从 GitHub 仓库部署。
2. 选择你部署拟像画布的仓库。
3. Railway 会读取 `package.json` 与 `railway.json`，使用 `npm start` 启动服务。
4. 部署完成后打开 Railway 提供的域名，右上角点击 `API`。
5. 填入你的模型 API URL；如果你的 API 需要鉴权，再填 API Key。
6. 点击免费开始后即可打开拟像画布。

可选环境变量：

- `NIXIANG_MODEL_API_URL`：服务默认模型 API URL。
- `NIXIANG_MODEL_API_KEY`：服务默认模型 API Key。

如果不配置环境变量，每个使用者也可以在浏览器右上角 `API` 面板里填写自己的 API URL。该配置只保存在当前浏览器。

## 本地图像 API

拟像提供一个本地桥接接口：

```text
POST /api/_bridge/nixiang/image-api
```

请求体兼容常见图片生成参数，例如：

```json
{
  "prompt": "一张电影感产品海报",
  "model": "default-image-model",
  "size": "1024x1024",
  "n": 1
}
```

参考图改图可在请求体里传 `image`、`image_url`、`images` 或 `imageUrls`，支持本地 `/uploads/...`、data URL 和公网图片 URL。返回结果会保存为本地 `/uploads/generated/...` 地址，方便画布直接展示。

配置方式：

- 环境变量：`NIXIANG_IMAGE_API_KEY`
- 可选 Base URL：`NIXIANG_IMAGE_API_URL`
- 浏览器内：右上角 `API` 面板填写 URL 和 Key

宿主端内置图片生成功能不提供给本地 Web 项目直接当公共 API 调用。需要程序化批量生图时，请使用 API Key 方式接入。

## 停止服务

使用 `npm start` 启动时，在终端按 `Ctrl+C` 停止服务。

双击 `停止拟像无限画布.cmd`。

## 包含内容

- 完整画布前端
- 本地 Node.js 后端
- “拟像 无限画布 · 全功能演示”项目数据
- 图片、视频、音频、分镜、表格和 AI 助手相关节点
- Windows 一键启动与停止脚本

## 环境要求

- Windows 10 或 Windows 11
- Node.js 22 或更高版本

首次启动时，程序会从 `canvas-server/data/seed` 创建本地运行数据。实际账号、会话、日志和生成结果保存在 `canvas-server/data/runtime`，该目录不会提交到 Git。

画布与配套视频均由拟像工作流辅助制作。
