import { z } from "zod"
import { collect, transform } from "streaming-iterables"
import { ModelRes, modelMsg, Msg, userMsg, funcCall, funcMsg, Json } from "./types"
import { sendAsk } from "./utils"
import { FunctionManager, TokenManager } from "./baseManager"

export interface Opt {
    // 会话key，即文心应用 key
    key: string,
    // 会话密钥，即文心应用密钥
    secret?: string,
    // 函数管理器
    functionManager?: FunctionManager,
    // token管理器
    tokenManager?: TokenManager,
    // 最大上下文容量 默认3
    contextSize?: number,
    // 每个问题结束时的回调
    onAskAns?: (things: { id: string, time: number, msg: Msg[], tokens: number }) => void | Promise<void>,
    // 是否使用 4.0 模型 默认是
    proModel?: boolean
}

export class ModelSession {
    #context: Msg[] = []
    #opt: Required<Opt>
    constructor(opt: Opt, resolve: (value: ModelSession) => void, reject: (reason?: any) => void) {
        this.#init(opt).then(resolve).catch(reject)
    }
    #init = async (opt: Opt) => {
        opt.contextSize = opt.contextSize ?? 3
        if (!(opt.contextSize >= 1 && opt.contextSize % 2 === 1)) {
            throw new Error("上下文容量必须为正奇数")
        }
        opt.onAskAns = opt.onAskAns ?? (() => { })
        opt.proModel = opt.proModel ?? true
        opt.tokenManager = opt.tokenManager ?? new TokenManager()
        if (opt.secret) {
            await opt.tokenManager.login(opt.key, opt.secret)
        }
        opt.functionManager = opt.functionManager ?? new FunctionManager()
        this.#opt = opt as Required<Opt>
        return this
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
        const token = await this.#opt.tokenManager.get(this.#opt.key)
        // 获取 funcs
        const funcs = await collect(this.#opt.functionManager.funcsIter())
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
            let res: {
                type: "chat",
                content: string
            } | { type: "func", name: string, args: object, exec: () => Promise<{ result: object, say: () => Promise<AsyncIterableIterator<string>> }> } = {
                type: "chat",
                content: chunk.result
            }
            if (chunk.is_end) {
                // 触发函数调用
                if (chunk.function_call) {
                    const name = chunk.function_call.name
                    const args = JSON.parse(chunk.function_call.arguments)
                    this.#context[this.#context.length - 1]["function_call"] = args
                    res = {
                        type: "func",
                        name,
                        args,
                        exec: async () => {
                            const result = await this.#opt.functionManager.invokeFunc(name, args)
                            return {
                                result,
                                say: async () =>
                                    transform<ModelRes, string>(Infinity,
                                        (chunk) => chunk.result,
                                        await sendAsk(token,
                                            this.#context.concat([<z.infer<typeof funcMsg>>{
                                                role: "function",
                                                name,
                                                content: JSON.stringify(result)
                                            }]), funcs, this.#opt.proModel)
                                    )
                            }
                        },

                    }
                }
                await this.#opt.onAskAns({ id: chunk.id, time: chunk.created, tokens: chunk.usage.total_tokens, msg: [askMsg, this.#context[this.#context.length - 1]] })
            }
            return res
        }, res)
    }
}

export const newSession = async (opt: Opt) => new Promise<ModelSession>((resolve, reject) => new ModelSession(opt, resolve, reject))
export * from "./baseManager"
export * from "./utils"
export * from "./types"
