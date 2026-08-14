# dsh-plugins

个人 DeepSeek Harness 插件集合。

## balance-display

为 DeepSeek Harness Web UI 增加：

- DeepSeek API 账户余额显示
- 手动刷新与 10 分钟缓存

由两个插件组成：

| 包 | 作用 |
| --- | --- |
| `@xsuas/dsh-balance-display` | 宿主端余额查询 |
| `@xsuas/dsh-client-balance-display` | Web UI 余额显示 |

## 安装

```sh
dsh plugin --profile web add file:<仓库路径>/plugins/balance-display
dsh plugin --profile web add file:<仓库路径>/plugins/client-balance-display
```

在 `$DSH_HOME/profiles/web/cordis.patch.yml` 添加：

```yaml
- insert:
    - id: balance-display
      name: '@xsuas/dsh-balance-display'
    - id: client-balance-display
      name: '@xsuas/dsh-client-balance-display'
```

重新启动：

```sh
dsh web
```

## 卸载

从 `cordis.patch.yml` 删除对应配置，然后执行：

```sh
dsh plugin --profile web remove @xsuas/dsh-balance-display
dsh plugin --profile web remove @xsuas/dsh-client-balance-display
```

## 安全

API Key 仅由宿主插件读取，不会返回给浏览器。

## 测试

```sh
node tests/balance-display.test.mjs
node tests/client-bundle.test.mjs
```

## License

MIT
