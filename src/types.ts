import { z } from "zod"
import { mkFunc } from "./utils";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
export type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]));

const funcCall = z.object({ name: z.string(), arguments: jsonSchema, thoughts: z.string().optional() })

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
    input: Args
    output: Returns
    func: z.infer<z.ZodFunction<z.ZodTuple<[Args]>, Returns>>,
    examples?: z.infer<typeof msg>[]
}

export type MFunc = ReturnType<typeof mkFunc>