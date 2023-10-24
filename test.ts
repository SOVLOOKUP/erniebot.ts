import { config } from "dotenv"
import { newSession, FunctionManager } from './src';
import { z } from "zod"
const { parsed } = config()


const functionManager = new FunctionManager()

const session = await newSession({
    key: parsed.KEY, secret: parsed.SECRET,
    functionManager
})

await functionManager.addFunc({
    name: "find_wh",
    description: "网红名字查询",
    input: z.object({
        name: z.string()
    }),
    output: z.object({ names: z.array(z.string()).describe("网红的名字") }),
    func: () => ({ names: ["拜拜"] })
})

for await (const a of await session.ask("网红提莫的情况？")) {
    console.log(a);
    if (a.type === "func") {
        const res = await a.exec()
        for await (const s of await res.say()) {
            console.log(s);
        }
    }
}

for await (const a of await session.ask("中国全称？")) {
    console.log(a);
}

for await (const a of await session.ask("那英国呢？")) {
    console.log(a);
}
