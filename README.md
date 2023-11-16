# 文心一言 TypeScript SDK

在浏览器和 Nodejs 中调用文心一言的大模型能力且支持动态函数解析和插件

[**在线演示应用**](https://ai.metapoint.tech/)

## 安装

```js
pnpm add erniebot.ts
```

## 用法

查看 https://github.com/SOVLOOKUP/erniebot.ts/blob/main/test.ts

```ts
import { newSession } from 'erniebot.ts';
import Plugin from "erniebot-plugin-demo"

// 初始化会话(全部参数定义:https://github.com/SOVLOOKUP/erniebot.ts/blob/main/src/types.ts#L7)
const session = await newSession({ key: parsed.KEY, secret: parsed.SECRET })

// 添加插件
await session.addPlugin("test_plugin", Plugin)

// 开启对话
for await (const msg of await session.ask("你好")) {
    console.log(msg)
}
```

## 插件

插件命名前戳: `erniebot-plugin-`

**定义:**
https://github.com/SOVLOOKUP/erniebot.ts/blob/main/src/types.ts#L30

**例子:**
[erniebot-plugin-demo](./erniebot-plugin-demo)

## LISENCE

MIT