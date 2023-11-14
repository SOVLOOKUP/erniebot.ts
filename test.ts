import { config } from "dotenv"
import { newSession } from './src';
import Plugin from "./erniebot-plugin-demo"
import { createInterface } from "readline/promises"

const { parsed } = config()
const session = await newSession({ key: parsed.KEY, secret: parsed.SECRET })

// 添加插件
await session.addPlugin("test_plugin", Plugin)
console.log("已安装插件:", await session.listPlugin());

// 问一个问题, 触发 find_wh 函数调用
for await (const a of await session.ask("网红提莫的名字？")) {
    console.log(a);
    if (a.type === "func") {
        const res = await a.exec()
        for await (const s of await res.say()) {
            console.log(s);
        }
    }
}

// 开启交互式问答, 如果你发送 "再见", 文心一言将调用 exit 函数结束 Nodejs 进程
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
})
while (true) {
    const ask = await rl.question("我: ")
    rl.write("文心一言: \n")
    for await (const a of await session.ask(ask)) {
        if (a.type === "chat") {
            rl.write(a.content)
        } else {
            rl.write(a.thoughts)
            const res = await a.exec()
            for await (const s of await res.say()) {
                rl.write(s)
            }
        }
    }
    rl.write('\n')
}
