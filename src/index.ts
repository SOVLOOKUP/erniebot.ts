import { z } from "zod"
import { collect, transform } from "streaming-iterables"
import { ModelRes, modelMsg, Msg, userMsg } from "./types"
import { sendAsk } from "./utils"
import { FunctionManager, TokenManager } from "./baseManager"

export interface Opt {
    key: string,
    contextSize?: number,
    onAskAns?: (things: { id: string, time: number, msg: Msg[], tokens: number }) => void | Promise<void>,
    proModel?: boolean
}

export class ModelSession {
    #fm: FunctionManager
    #tm: TokenManager
    #context: Msg[] = []
    #opt: Required<Opt>
    constructor(
        opt: Opt,
        fm: FunctionManager,
        tm: TokenManager
    ) {
        this.#fm = fm
        this.#tm = tm
        opt.contextSize = opt.contextSize ?? 3
        opt.onAskAns = opt.onAskAns ?? (() => { })
        opt.proModel = opt.proModel ?? true
        if (!(opt.contextSize >= 1 && opt.contextSize % 2 === 1)) {
            throw new Error("上下文容量必须为正奇数")
        }
        this.#opt = opt as Required<Opt>
    }
    ask = async (msg: string) => {
        // 记录问题
        const askMsg = <z.infer<typeof userMsg>>{
            role: "user",
            content: msg
        }
        this.#context.push(askMsg)
        if (this.#context.length > this.#opt.contextSize) {
            this.#context = this.#context.slice(this.#context.length - this.#opt.contextSize, this.#context.length)
        }
        // 获取 token
        const token = await this.#tm.get(this.#opt.key)
        // 获取 funcs
        const funcs = await collect(this.#fm.funcsIter())
        let res: AsyncIterableIterator<ModelRes>
        // 发送问题
        if (token) {
            if (funcs.length > 0) {
                res = await sendAsk(token, this.#context, funcs, this.#opt.proModel)
            } else {
                res = await sendAsk(token, this.#context, undefined, this.#opt.proModel)
            }
        } else {
            throw new Error("不能使用未登录或已删除的账号 Token 发起会话，请先登录！")
        }
        // 记录回答
        this.#context.push(<z.infer<typeof modelMsg>>{
            role: "assistant",
            content: ""
        })
        return transform(Infinity, async (chunk) => {
            this.#context[this.#context.length - 1].content += chunk.result
            if (chunk.is_end) {
                await this.#opt.onAskAns({ id: chunk.id, time: chunk.created, tokens: chunk.usage.total_tokens, msg: [askMsg, this.#context[this.#context.length - 1]] })
            }
            return chunk.result
        }, res)
    }
}

export const newBaseSession = async (key: string, secret: string) => {
    const tm = new TokenManager()
    await tm.login(key, secret)
    const fm = new FunctionManager()
    const ms = new ModelSession({ key }, fm, tm,)
    return { fm, tm, ms }
}