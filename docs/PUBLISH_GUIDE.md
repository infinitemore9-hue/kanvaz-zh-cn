# GitHub 发布步骤

建议仓库名：kanvaz-zh-cn。建议版本标签：v9.8.2-cn.simple.5.1。

## 建立仓库

可 Fork 原项目以保留 Git 历史，再提交本修改版与文档；也可新建仓库上传本目录内容，并通过 FORK_NOTICE.md 保留上游来源和基线记录。不要把此目录的修改推送到原作者仓库。

只上传 repository 内的源码文件。不要把整个交付包 ZIP、dist、node_modules、temp、Electron 运行时、规划文件或私人画板提交到 Git 仓库。仓库 package.json 的 private:true 只阻止误发 npm，不限制 GitHub 仓库公开。

## 创建发行版

1. 源码进入自己的仓库后，打开 Releases，创建 v9.8.2-cn.simple.5.1 发行版。
2. 标题和说明使用 release-notes.md。
3. 上传 release-assets 内的 Windows ZIP、源码 ZIP、校验清单和测试报告。不要上传旧版完整交付包作为唯一程序入口。
4. 确认原作者署名、已知限制、程序包都在，再发布。

当前手动检查工作流不自动创建发行版。GitHub 自动生成的 Source code 附件是源码，不是可执行程序。

## 发布后

在自己的 Windows 电脑上从发行页面重新下载、解压并试运行。GitHub 线上检查成功必须以实际运行记录为准，本地通过不能当作 Actions 已通过。
