import { z } from "zod"
import { collect, filter, consume, map } from 'streaming-iterables';
import { ModelRes, modelMsg, Msg, userMsg, funcMsg, ModelReturn, Opt, AskAnsHook, Plugin, PkgInfo } from "./types"
import { sendAsk } from './utils';
import { FunctionManager, PluginManager, TokenManager } from "./baseManager"
export { z }

export class ModelSession {
    #context: Msg[] = []
    #opt: Required<Opt>
    #ansAnsHook: Map<string, AskAnsHook> = new Map()
    constructor(opt: Opt, resolve: (value: ModelSession) => void, reject: (reason?: any) => void) {
        this.#init(opt).then(resolve).catch(reject)
    }
    #init = async (opt: Opt) => {
        // 初始化TokenManager
        opt.tokenManager = opt.tokenManager ?? new TokenManager()
        if (opt.secret) {
            await opt.tokenManager.login(opt.key, opt.secret)
        }
        // 初始化FunctionManager
        opt.functionManager = opt.functionManager ?? new FunctionManager()
        // 初始化最大容量设置
        opt.contextSize = opt.contextSize ?? 1
        if (opt.contextSize < 0) {
            throw new Error("上下文容量必须为正数")
        }
        // 初始化onAskAns HOOK
        opt.onAskAns = opt.onAskAns ?? (() => { })
        // 初始化模型类别参数
        opt.proModel = opt.proModel ?? false
        // 初始化sendAsk函数
        opt.sendAsk = opt.sendAsk ?? sendAsk
        // 初始化PluginManager及加载器
        opt.pluginManager = opt.pluginManager ?? new PluginManager()
        opt.pluginLoader = opt.pluginLoader ?? (async (name) => await import(name))
        // 存储参数
        this.#opt = opt as Required<Opt>
        // 初始化插件
        const installedPlugins = await opt.pluginManager.list()
        // 不需要重复注册
        const installPlugins = installedPlugins.map((plugin) => this.loadPlugin(plugin, false))
        // 加载插件
        await Promise.all(installPlugins)
        return this
    }
    #sendAsk = async (ctx?: Msg[]) => {
        let res: AsyncIterable<ModelRes>
        const context = ctx ?? this.#context
        // 获取 token
        const token = await this.#opt.tokenManager.get(this.#opt.key)
        // 获取 funcs
        const funcs = await collect(this.#opt.functionManager.listFunc())
        // 发送问题
        if (token) {
            if (funcs.length > 0) {
                res = await this.#opt.sendAsk(token, context, funcs, this.#opt.proModel)
            } else {
                res = await this.#opt.sendAsk(token, context, undefined, this.#opt.proModel)
            }
        } else {
            throw new Error("不能使用未登录或已删除的账号 Token 发起会话，请先登录！")
        }
        return res
    }
    // 使用插件加载器加载插件
    loadPlugin = async (name: string, register = true) => {
        const module = await this.#opt.pluginLoader(name)
        await this.addPlugin(name, module, register)
    }
    // 直接添加插件
    addPlugin = async (name: string, plugin: Plugin, register = true) => {
        const prefix = name + "__"
        await plugin({
            addFunc: async (...funcs) => {
                await this.#opt.functionManager.addFunc(...funcs.map(func => { func.name = prefix + func.name; return func; }));
            },
            delFunc: async (name) => await this.#opt.functionManager.delFunc(prefix + name),
            funcsIter: (() => {
                const mine = filter((chunk) => chunk.name.startsWith(prefix), this.#opt.functionManager.listFunc())
                return map((chunk) => { chunk.name = chunk.name.replace(prefix, ""); return chunk }, mine)
            })(),
            setAskAnsHook: (hook) => {
                this.#ansAnsHook.set(name, hook)
            }
        })
        if (register) await this.#opt.pluginManager.add(name)
    }
    // 移除插件
    removePlugin = async (name: string) => {
        const prefix = name + "__"
        const funcsIter = filter((chunk) => chunk.name.startsWith(prefix), this.#opt.functionManager.listFunc())
        await consume(map((chunk) => { this.#opt.functionManager.delFunc(chunk.name) }, funcsIter))
        if (this.#ansAnsHook.has(name)) {
            this.#ansAnsHook.delete(name)
        }
        await this.#opt.pluginManager.del(name)
    }
    // 列出已安装插件
    listPlugin = () => this.#opt.pluginManager.list()
    // 发起问话
    ask = async (msg: string): Promise<AsyncIterable<ModelReturn>> => {
        // 获取 Hooks
        const afterHooks = this.#ansAnsHook.values()
        // 记录问题
        const askMsg = <z.infer<typeof userMsg>>{
            role: "user",
            content: msg
        }
        this.#context.push(askMsg)
        const maxMsgSize = this.#opt.contextSize * 2 + 1
        if (this.#context.length > maxMsgSize) {
            this.#context = this.#context.slice(this.#context.length - maxMsgSize, this.#context.length)
        }
        const res = await this.#sendAsk()
        // 记录回答
        this.#context.push(<z.infer<typeof modelMsg>>{
            role: "assistant",
            content: ""
        })
        return map(async (chunk) => {
            this.#context[this.#context.length - 1].content += chunk.result
            let res: ModelReturn = {
                type: "chat",
                content: chunk.result
            }
            if (chunk.is_end) {
                // 触发函数调用
                if (chunk.function_call) {
                    const name = chunk.function_call.name
                    const args = JSON.parse(chunk.function_call.arguments)
                    delete this.#context[this.#context.length - 1]["content"]
                    this.#context[this.#context.length - 1]["function_call"] = chunk.function_call
                    res = {
                        type: "func",
                        name,
                        args,
                        thoughts: chunk.function_call.thoughts,
                        exec: async () => {
                            const result = await this.#opt.functionManager.invokeFunc(name, args)
                            return {
                                result,
                                say: async () => map<ModelRes, string>(
                                    async (chunk) => chunk.result,
                                    await this.#sendAsk(this.#context.concat([<z.infer<typeof funcMsg>>{
                                        role: "function",
                                        name,
                                        content: JSON.stringify(result)
                                    }]))
                                )
                            }
                        },
                    }
                }
                const input = { id: chunk.id, time: chunk.created, tokens: chunk.usage.total_tokens, msg: [askMsg, this.#context[this.#context.length - 1]] }
                await this.#opt.onAskAns(input)
                consume(map(async (func) => await func(input), afterHooks))
            }
            return res
        }, res)
    }
}

export const newSession = async (opt: Opt) => new Promise<ModelSession>((resolve, reject) => new ModelSession(opt, resolve, reject))
// 搜索插件
export const searchPlugin = async (name: string = '', page: number = 1) => {
    if (page > 1000 || page < 0) {
        return null
    }
    const r = await fetch(`https://registry.npmmirror.com/-/v1/search?text=erniebot-plugin-${name}&size=10&from=${page - 1}`)
    const res = await r.json() as PkgInfo
    res.objects = res.objects.filter((object) => object.package.name.startsWith("erniebot-plugin-"))
    return res
}

export * from "./baseManager"
export * from "./utils"
export * from "./types"
