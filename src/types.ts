import { z } from "zod"
import { mkFunc, sendAsk } from './utils';
import type { FunctionManager, PluginManager, TokenManager } from "./baseManager";

export interface AskAns { id: string, time: number, msg: Msg[], tokens: number }
export type AskAnsHook = (askAns: AskAns) => void | Promise<void>
export interface Opt {
    // 会话key，即文心应用 key
    key: string,
    // 会话密钥，即文心应用密钥
    secret?: string,
    // 函数管理器
    functionManager?: FunctionManager,
    // token管理器
    tokenManager?: TokenManager,
    // plugin管理器
    pluginManager?: PluginManager,
    // 上下文包括的对话轮数 默认1
    contextSize?: number,
    // 每个问题结束时的默认回调
    onAskAns?: AskAnsHook,
    // 是否使用 4.0 模型 默认否
    proModel?: boolean,
    // 自定义消息发送器
    sendAsk?: typeof sendAsk,
    // 插件加载器
    pluginLoader?: (name: string) => Plugin | Promise<Plugin>
}

export type Plugin = (opt: {
    // 添加可调用函数
    addFunc: FunctionManager["addFunc"],
    // 删除可调用函数
    delFunc: FunctionManager['delFunc'],
    // 查询可调用函数
    funcsIter: FunctionManager['funcsIter'],
    // 设置对话后 HOOK
    setAskAnsHook: (hook: AskAnsHook) => void | Promise<void>,
}) => void | Promise<void>

export type ModelReturn = {
    type: "chat",
    content: string
} | { type: "func", name: string, thoughts: string, args: object, exec: () => Promise<{ result: object, say: () => Promise<AsyncIterable<string>> }> }

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
export type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]));

export const funcCall = z.object({ name: z.string(), arguments: z.string(), thoughts: z.string() })

export const userMsg = z.object({
    role: z.literal("user"),
    content: z.string()
})

export const modelMsg = z.object({
    role: z.literal("assistant"),
    function_call: funcCall.optional(),
    content: z.string().optional()
})

export const funcMsg = z.object({
    role: z.literal("function"),
    name: z.string(),
    content: jsonSchema
})

export const msg = z.union([userMsg, modelMsg, funcMsg])
export type Msg = z.infer<typeof msg>

export interface ModelRes {
    id: string,
    created: number,
    result: string,
    function_call: z.infer<typeof funcCall>,
    is_end: boolean,
    is_truncated: boolean,
    need_clear_history: boolean,
    object: "chat.completion",
    sentence_id: number,
    ban_round: number,
    usage: {
        total_tokens: number,
        prompt_tokens: number,
        completion_tokens: number,
        plugins?: {
            name: string,
            total_tokens: number,
            parse_tokens: number,
            abstract_tokens: number,
            search_tokens: number,
        }[]
    }
}

export interface FuncInput<Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>> {
    name: string
    description: string
    input?: Args
    output?: Returns
    func: z.infer<z.ZodFunction<z.ZodTuple<[Args]>, Returns>> | z.infer<z.ZodFunction<z.ZodTuple<[Args]>, z.ZodPromise<Returns>>>,
    examples?: {
        ask: string
        input: z.infer<Args>
        output: z.infer<Returns>
    }[]
}

export type MFunc = ReturnType<typeof mkFunc>