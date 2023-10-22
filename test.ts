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
    output: z.object({ names: z.array(z.string()) }),
    func: () => ({ names: ["拜拜"] })
})

for await (const a of await session.ask("说说常见的网红")) {
    // process.stdout.write(a)
}

// for await (const a of await session.ask("那美国有吗呢？")) {
//     process.stdout.write(a)
// }

// for await (const a of await session.ask("那英国呢？")) {
//     process.stdout.write(a)
// }
