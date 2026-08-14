# dsh-plugins

个人 DeepSeek Harness（`dsh`）插件集合。每个插件一个文件夹，宿主面（`*-`）与浏览器面（`client-*`）成对，遵循官方双面包惯例。

## 插件清单

| 文件夹 | 包名 | 作用 |
|---|---|---|
| `plugins/balance-display` | `@xsuas/dsh-balance-display` | 宿主插件：查询 DeepSeek API 账户余额（10 分钟缓存），提供同源只读路由 `/api/balance` |
| `plugins/client-balance-display` | `@xsuas/dsh-client-balance-display` | 客户端插件：输入框工具行左侧"余额"芯片，点击弹出与官方模型菜单同款的菜单（余额 + 会话 token 用量两行；余额可点击刷新、10 分钟自动重拉） |

## 安装（web profile）

```sh
dsh plugin --profile web add file:<本仓库绝对路径>/plugins/balance-display
dsh plugin --profile web add file:<本仓库绝对路径>/plugins/client-balance-display
```

然后在 `$DSH_HOME/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: balance-display
      name: '@xsuas/dsh-balance-display'
    - id: client-balance-display
      name: '@xsuas/dsh-client-balance-display'
```

重启 `dsh web` 并刷新浏览器页面生效。

## 回滚

删除上面两行 patch 并执行 `dsh plugin --profile web remove <包名>`（两个包各一次），重启即可完全还原。

## 隐私与安全

- API 密钥仅存在于宿主进程（经官方凭据服务解析），不落盘、不写日志、不进浏览器；
- `/api/balance` 只返回余额数值，且仅接受回环地址（127.0.0.1/localhost）请求；
- 除 `api.deepseek.com` 外无任何网络请求，无遥测、无埋点；
- 客户端仅缓存余额数值与时间戳，不写入任何敏感数据。

## 开发新插件

在 `plugins/` 下新建 `xxx`（宿主）与 `client-xxx`（浏览器）两个文件夹，包名建议 `@<你的scope>/dsh-xxx` 与 `@<你的scope>/dsh-client-xxx`，然后按上述安装方式装载。

客户端 bundle 为手写产物（无构建步骤），格式参考官方 `dsh-client-ui-goal` 发布物：`window.__ModuleLoader__.load({ id, factory(require) })`，工厂内只允许 `require("react")` / `require("react/jsx-runtime")` 这两个 seed 词。

## 测试

```sh
node tests/balance-display.test.mjs   # 宿主插件（凭据解析、缓存、并发合并、回环防护）
node tests/client-bundle.test.mjs     # 客户端 bundle（工厂/插槽注册/渲染级；自动定位 react，缺失则跳过）
```

CI：每次推送自动运行上述两个测试套件（`.github/workflows/test.yml`）。

## 许可

MIT。本仓库为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）生态插件；插槽/加载器接口设计归 DeepSeek AI 所有。
