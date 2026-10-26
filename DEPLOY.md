# 发布到 GitHub Pages

这是一个纯静态网站，不需要构建。默认发布地址为 `https://internlm.github.io/SIM-CoT/`，即直接用代码仓库 `InternLM/SIM-CoT` 的 `docs/` 目录发布。需要该仓库的管理员权限（修改 Pages 设置）。

| 用途 | 地址或名称 |
| --- | --- |
| 代码仓库 | `https://github.com/InternLM/SIM-CoT` |
| 网站目录 | 仓库根目录下的 `docs/` |
| 发布后的主页 | `https://internlm.github.io/SIM-CoT/` |

## 1. 放入 `docs/` 目录

把本文件夹里的**全部内容**（包括隐藏文件 `.nojekyll`）复制到仓库根目录的 `docs/` 下：

```bash
git clone https://github.com/InternLM/SIM-CoT.git
cd SIM-CoT
mkdir -p docs
cp -r /path/to/SIM-CoT-homepage/. docs/
git add docs
git commit -m "Add project page"
git push origin main
```

完成后 `docs/index.html` 应直接位于 `docs/` 下，`docs/assets/` 与它同级。

也可以在网页上操作：仓库页面 **Add file → Upload files**，把解压后的文件拖进去，并在路径前加上 `docs/`。网页上传容易漏掉以点开头的 `.nojekyll`，可用 **Add file → Create new file** 新建一个空的 `docs/.nojekyll`。

## 2. 打开 Pages

进入仓库 **Settings → Pages → Build and deployment**：

1. **Source** 选择 **Deploy from a branch**。
2. **Branch** 选择 `main`，目录选择 `/docs`，点击 **Save**。

一两分钟后，**Settings → Pages** 顶部会显示网址 `https://internlm.github.io/SIM-CoT/`。以后每次向 `main` 推送 `docs/` 的改动都会自动重新发布。

## 另一种方式：单独建一个仓库

如果不想放进代码仓库，可以新建一个公开仓库（例如个人账号下的 `SIM-CoT`），在网页上 **Add file → Upload files**，把解压后的全部文件直接上传到仓库根目录（`index.html` 位于根目录），再在 **Settings → Pages** 选择 `main` 分支、目录 `/ (root)`。发布地址为 `https://<用户名>.github.io/SIM-CoT/`；仓库名若是 `<用户名>.github.io`，地址就是 `https://<用户名>.github.io/`。换地址后请按下文修改分享图片网址。

## 3. 更新 README 的主页链接

把 README 中的 `[[🏠Project Page]()]` 改成 `[[🏠Project Page](https://internlm.github.io/SIM-CoT/)]`。

## 分享图片网址

`index.html` 里的 `og:url`、`og:image` 和 `twitter:image` 使用完整地址 `https://internlm.github.io/SIM-CoT/…`，社交平台据此显示预览图。如果改用其他仓库或域名（例如个人账号下的 `https://<用户名>.github.io/<仓库名>/`），请同步修改这三处。页面中的其他路径都是相对路径，无需改动。

## 官方文档

- [配置 GitHub Pages 的发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
