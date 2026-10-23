# Kanvaz 简体中文修改版

基于 [Kanvaz](https://github.com/p4inz-code/kanvaz) 的**非官方衍生版本**，提供简体中文界面和参考图片工作流改进。原始项目由 **Atharva Patil | P4inz | P4inz Interactive Labs** 开发，本仓库保留原版权和 MIT 许可；不代表原作者的官方发布。

[已验证的发布回执](docs/PUBLICATION.md)。

当前公开整理版本：**9.8.2-cn.simple.5.1**。基于上游 v9.8.2，程序内部基础版本仍为 9.8.2。已构建、运行验证的是 **Windows x64 目录式便携版**；本次未构建或验证 macOS、Linux 与 ARM 版本。

## 下载与启动

在本仓库的 [Releases（发行版）](https://github.com/infinitemore9-hue/kanvaz-zh-cn/releases) 页面下载 Windows x64 ZIP。GitHub 自动生成的 Source code ZIP 只有源码，不能直接运行。

1. 关闭旧程序，先另存重要画板备份。
2. 将 Windows ZIP 完整解压到新文件夹。
3. 运行其中的“Kanvaz 中文版.exe”，保留同目录所有文件。

此版本未签名，是目录式便携程序。公开整理版关闭了原项目自动更新入口；请从本修改版的发行页面手动下载新版。

## 主要改动

- 默认简体中文，保留中英文切换；简洁启动界面，可切换完整界面。
- 多文件导入后自动排列，保留导入时的显示尺寸，间距支持 0 像素。
- 空白画布左键框选，Shift 追加选择，空格加左键或鼠标中键平移。
- 多选整体拖动与边缘/中心吸附，透明图片可按可见内容联合矩形吸附和框选。
- 透明图片外框、内容边界和悬停棋盘格，帮助识别透明留白。
- 外部图片文件稳定后单张刷新，保持画板上的位置和显示尺寸；支持暂停、手动刷新和重新关联。
- Esc 取消单张或多选拖动；批量导入和排列合并为一步撤销。
- 原图像素检查窗口；导入 PNG 的原始字节在测试中保持不变。

## 操作提示

| 操作 | 方法 |
|---|---|
| 框选多个对象 | 在空白画布按住左键拖动 |
| 追加框选 | Shift 加左键拖动 |
| 平移画布 | 空格加左键，或鼠标中键 |
| 取消当前拖动 | Esc，恢复本次拖动前的位置 |
| 参考工具/图片源管理 | F9 |
| 参考视图 | F8 |
| 撤销/重做 | Ctrl+Z / Ctrl+Y |

按可见内容吸附与框选可在设置中关闭，关闭后按完整图片矩形计算。图片源管理中可查看刷新结果和最近成功更新时间。

## 验证与限制

公开整理版的实际测试结果见 [验证报告](docs/TEST_RESULTS.md)。已有上游代码和本地测试不等于所有功能都已验证。

- 没有使用真实 Photoshop 或 Illustrator 的保存过程完成端到端验证。测试覆盖直接写入、临时文件替换和损坏后恢复，不宣称全面兼容这些软件或 PureRef。
- 可见内容范围是 alpha 阈值计算的联合矩形，不是逐像素命中，也不会拆分同一 PNG 中的多个物件。超过 4096 像素的图像边界使用采样。
- 外部文件每秒轮询，稳定性采样和解码会增加等待时间；不是即时预览。受支持路径数上限 1000、监视文件大小上限 128 MiB。
- 窗口失焦取消拖动已做模拟事件验证，真实 Alt+Tab、多显示器等情况尚未完整验证。
- 动画 GIF 的逐帧透明范围、大规模超高清素材性能，以及所有格式尚未全面验证。
- 工具面板仍是模态面板；临时绕过吸附和操作数量提示尚未完成。
- 保留的上游插件/模板目录入口可能按用户操作访问原项目服务；这些是上游内容，不代表本修改版另有独立服务。

## 从源码运行与构建

安装 Node.js 与 npm 后，在项目根目录执行：

```powershell
npm ci
npm start
```

Windows x64 目录式构建：

```powershell
npx electron-builder --win dir --x64 --publish never
```

构建结果在 dist/win-unpacked。依赖锁定文件随源码提供；打包工具配置为手动发布，未连接任何上游自动发布目标。npm ci 下载运行时需要网络。以上为重建步骤；已执行构建的方法、环境和实际结果见验证报告。

```powershell
npm run lint
npm run validate
```

validate 可能因缺少独立 Chrome 或插件依赖而跳过部分测试，SKIP 不等于通过。Electron 交互测试要求先完成目录式构建。

docs/guide、项目概览等继承文档描述原项目，不能当作本修改版的构建或兼容性验证。

## 来源与许可

- 原项目：[p4inz-code/kanvaz](https://github.com/p4inz-code/kanvaz)
- 本修改版基线提交：3010cecf3e50cf97706e4300cf912b6469bf26ae。
- 原始作者：Atharva Patil | P4inz | P4inz Interactive Labs。
- [MIT 许可证](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md) · [衍生版本说明](FORK_NOTICE.md) · [修改记录](FORK_CHANGELOG.md)。

PureRef、Photoshop 和 Illustrator 仅作为操作需求中的参照产品提及，不表示相关厂商授权、参与或背书。
