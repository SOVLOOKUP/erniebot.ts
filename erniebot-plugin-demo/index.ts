import { type Plugin, z } from "../src";

const plugin: Plugin = async ({ addFunc, setAskAnsHook }) => {
    console.log("文心一言测试插件");
    await setAskAnsHook((aa) => {
        console.log("插件回调：", aa);
    })
    await addFunc(
        {
            name: "find_wh",
            description: "网红名字查询",
            input: z.object({
                name: z.string()
            }),
            output: z.object({ names: z.array(z.string()).describe("网红的名字") }),
            func: () => ({ names: ["小雨"] }),
            examples: [
                {
                    ask: "网红提莫的情况？",
                    input: { name: "提莫" },
                    output: { names: ["小雨"] }
                }
            ]
        }
    )
    await addFunc(
        {
            name: "exit",
            description: "退出对话，结束对话，终止对话。用户在说“拜拜”、“再见”等词时调用",
            func: () => {
                if (window !== undefined) {
                    alert("来自 DEMO 插件: 再见！")
                } else {
                    process.exit()
                }
            }
        }
    )
}

export default plugin