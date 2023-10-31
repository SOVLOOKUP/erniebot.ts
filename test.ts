import { config } from "dotenv"
import { newSession, FunctionManager } from './src';
import { z } from "zod"
import { createInterface } from "readline/promises"

const { parsed } = config()
const functionManager = new FunctionManager()

const session = await newSession({
    key: parsed.KEY, secret: parsed.SECRET,
    functionManager
})

await functionManager.addFunc(
    {
        name: "find_wh",
        description: "网红名字查询",
        input: z.object({
            name: z.string()
        }),
        output: z.object({ names: z.array(z.string()).describe("网红的名字") }),
        func: () => ({ names: ["小雨"] }),
        examples: [{
            ask: "网红提莫的情况？",
            input: { name: "提莫" },
            output: { names: ["小雨"] }
        }]
    },
    {
        name: "exit",
        description: "退出对话，结束对话，终止对话。用户在说“拜拜”、“再见”等词时调用",
        func: () => process.exit()
    }
)

for await (const a of await session.ask("网红提莫的名字？")) {
    console.log(a);
    if (a.type === "func") {
        const res = await a.exec()
        for await (const s of await res.say()) {
            console.log(s);
        }
    }
}

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