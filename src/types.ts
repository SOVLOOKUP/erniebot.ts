import { z } from "zod"
import { mkFunc } from "./utils";
import type { FunctionManager, TokenManager } from "./baseManager";

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

export type ModelReturn = {
    type: "chat",
    content: string
} | { type: "func", name: string, thoughts: string, args: object, exec: () => Promise<{ result: object, say: () => Promise<AsyncIterableIterator<string>> }> }

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
    func: z.infer<z.ZodFunction<z.ZodTuple<[Args]>, Returns>>,
    examples?: {
        ask: string
        input: z.infer<Args>
        output: z.infer<Returns>
    }[]
}

export type MFunc = ReturnType<typeof mkFunc>