import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { FuncInput, Json, MFunc, ModelRes, Msg, msg } from "./types"
import { flatten, map } from 'streaming-iterables';

export const mkFunc = <Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }> | z.ZodVoid>(func: FuncInput<Args, Returns>) => {
    func.input = func.input ?? z.object({}) as Args
    const res = {
        name: func.name,
        description: func.description,
        parameters: zodToJsonSchema(func.input),
        responses: func.output ? zodToJsonSchema(func.output) : undefined,
        examples: undefined as undefined | Msg[],
    }
    if (func.examples) {
        res.examples = func.examples.map<Msg[]>(example => [
            { "role": "user", "content": example.ask },
            { "role": "assistant", "content": null, "function_call": { "name": func.name, "arguments": JSON.stringify(example.input) } },
            { "role": "function", "name": func.name, "content": JSON.stringify(example.output) }
        ]).flat()
    }
    return res
}

export const sendAsk = async (token: string, msgs: z.infer<typeof msg>[], funcs?: MFunc[], pro = false): Promise<AsyncIterable<ModelRes>> => {
    const res = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions${pro ? "_pro" : ""}?access_token=${token}`, {
        method: "POST",
        body: JSON.stringify({
            messages: msgs,
            functions: funcs,
            stream: true
        }),
        headers: {
            "Content-Type": "application/json",
            "x-bce-date": (new Date()).toISOString()
            // todo 计算 Authorization https://cloud.baidu.com/doc/Reference/s/hjwvz1y4f
        }
    })
    // 解码器
    const td = res.body?.pipeThrough(new TextDecoderStream())
    // 缓存
    let cache: string | undefined
    return flatten(map((chunk) => {
        const hasHead = chunk.startsWith("data: ")
        const hasTail = chunk.endsWith("}}\n\n")
        let mutiRes: ModelRes[]
        // 有头有尾(已经结束)
        if (hasHead && hasTail) {
            mutiRes = chunk.split("data: ").splice(1).map(d => JSON.parse(d))
        }
        // 有头无尾(还没结束)
        if (hasHead && !hasTail) {
            const yw = chunk.replace("data: ", "").split("\n\ndata: ")
            // 没结束的进 cache
            cache = yw.pop()
            mutiRes = yw.map(d => JSON.parse(d))
        }
        // 无头有尾(紧接上文)
        if (!hasHead && hasTail) {
            // 把头接上, 变成有头有尾
            mutiRes = (cache + chunk).split("data: ").map(d => JSON.parse(d))
            // cache用完了
            cache = undefined
        }
        // 无头无尾(中间段) 
        if (!hasHead && !hasTail) {
            cache += chunk
            mutiRes = []
        }
        return mutiRes
    }, td as unknown as AsyncIterable<string>))
}

export const login = async (key: string, secret: string) => {
    const res = await fetch(`https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${key}&client_secret=${secret}`)
    const jres = await res.json()
    const token = jres.access_token
    if (token) {
        return token as string
    } else {
        throw new Error(jres)
    }
}