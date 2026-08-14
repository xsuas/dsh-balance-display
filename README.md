# dsh-balance-display

DeepSeek Harness Web 余额显示插件。

## 功能

- 显示 DeepSeek API 账户余额
- 点击手动刷新
- 10 分钟余额缓存

## 安装

从 GitHub 安装：

```sh
dsh plugin --profile web add github:xsuas/dsh-balance-display
```

重新启动：

```sh
dsh web
```

本地开发：

```sh
dsh plugin --profile web add .
```

## 卸载

```sh
dsh plugin --profile web remove @xsuas/dsh-balance-display
```

## 安全

API Key 仅由宿主插件读取，不会返回给浏览器。

余额接口仅接受 localhost / 127.0.0.1 请求。

## 测试

```sh
npm test
```

## License

MIT
