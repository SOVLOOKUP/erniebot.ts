import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { collect } from "streaming-iterables"
const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() => z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]));

const funcCall = z.object({ name: z.string(), arguments: jsonSchema, thoughts: z.string().optional() })

const userMsg = z.object({
    role: z.literal("user"),
    content: z.string()
})

const modelMsg = z.object({
    role: z.literal("assistant"),
    function_call: funcCall
})

const funcMsg = z.object({
    role: z.literal("function"),
    name: z.string(),
    content: jsonSchema
})

const msg = z.union([userMsg, modelMsg, funcMsg])

interface FuncInput<Args extends z.ZodTuple<any, any>, Returns extends z.ZodTypeAny> {
    name: string
    description: string
    func: z.ZodFunction<Args, Returns>
    examples?: z.infer<typeof msg>[]
}

export const mkFunc = <Args extends z.ZodTuple<any, any>, Returns extends z.ZodTypeAny>(func: FuncInput<Args, Returns>) => {
    const parm = func.func.parameters()
    const rtns = func.func.returnType()
    return {
        name: func.name,
        description: func.description,
        parameters: parm._def.items.length === 0 ? { "type": "object", "properties": {} } : zodToJsonSchema(parm),
        responses: parm._def.items.length === 0 ? undefined : zodToJsonSchema(rtns),
        examples: func.examples,
    }
}

export class FunctionManager {
    #store: Map<string, ReturnType<typeof mkFunc>>
    constructor() {
        this.#store = new Map<string, ReturnType<typeof mkFunc>>()
    }
    funcsIter: () => IterableIterator<ReturnType<typeof mkFunc>> | AsyncIterableIterator<ReturnType<typeof mkFunc>> = () => this.#store.values()
    addFunc: <Args extends z.ZodTuple<any, any>, Returns extends z.ZodTypeAny>(func: FuncInput<Args, Returns>) => void | Promise<void> = (func) => {
        const f = mkFunc(func)
        this.#store.set(f.name, f)
    }
    delFunc: (name: string) => boolean | Promise<boolean> = (name) => this.#store.delete(name)
}

export class TokenManager {
    #store: Map<string, string>
    constructor() {
        this.#store = new Map<string, string>()
    }
    login: (key: string, secret: string) => Promise<void> = async (key: string, secret: string) => {
        const res = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${key}&client_secret=${secret}`)
        const jres = await res.json()
        const token = jres.access_token
        if (token) {
            this.#store.set(key, token)
        } else {
            throw new Error(jres)
        }
    }
    get: (key: string) => Promise<string | undefined> | string | undefined = (key: string) => this.#store.get(key)
    del: (key: string) => Promise<boolean> | boolean = (key: string) => this.#store.delete(key)
}

interface ModelRes {
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

const sendAsk = async (token: string, msgs: z.infer<typeof msg>[], funcs?: ReturnType<typeof mkFunc>[]) => {
    const messages = await msg.parseAsync(msgs)
    const res = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${token}`, {
        method: "POST",
        body: JSON.stringify({
            messages,
            functions: funcs
        })
    })
    const jres: ModelRes = await res.json()
    return jres
}

export class ModelSession {
    #fm: FunctionManager
    #tm: TokenManager
    #appKey: string;

    constructor(
        fm: FunctionManager,
        tm: TokenManager,
        appKey: string
    ) {
        this.#fm = fm
        this.#tm = tm
        this.#appKey = appKey
    }
    ask = async (msg: z.infer<typeof userMsg>) => {
        const msgs = [
            // todo context
            msg
        ]
        const token = await this.#tm.get(this.#appKey)
        const funcs = await collect(this.#fm.funcsIter())
        let res: ModelRes
        if (token) {
            if (funcs.length > 0) {
                res = await sendAsk(token, msgs, funcs)
            } else {
                res = await sendAsk(token, msgs)
            }
        } else {
            throw new Error("不能使用未登录或已删除的账号 Token 发起会话，请先登录！")
        }
        return res
    }
}

// console.log(await login("HFKbjiQfWpDy0vRKSlPP26vn", "mABdhU5WFtjX4zEVP4WUDRDlKWj1t2tW"));
export { };
