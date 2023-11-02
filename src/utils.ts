import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { FuncInput, Json, MFunc, ModelRes, Msg, msg } from "./types"
import { filter, transform } from "streaming-iterables"

export const mkFunc = <Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>>(func: FuncInput<Args, Returns>) => {
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

export const sendAsk = async (token: string, msgs: z.infer<typeof msg>[], funcs?: MFunc[], pro = false) => {
    const res = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions${pro ? "_pro" : ""}?access_token=${token}`, {
        method: "POST",
        body: JSON.stringify({
            messages: msgs,
            functions: funcs,
            stream: true
        }),
        headers: {
            "Content-Type": "application/json"
        }
    })
    const td = new TextDecoderStream()
    res.body?.pipeTo(td.writable)
    let cache: string | undefined

    return transform<string,ModelRes>(Infinity, (chunk: string) => {
            const parsed = chunk.split("data: ")
            // 接上个回复
            if (parsed.length === 1 && cache !== undefined) {
                parsed[0] = cache + parsed[0]
                cache = undefined
                // 没有回复完就暂存
                try {
                    return JSON.parse(parsed[0])
                } catch (error) {
                    cache = parsed[0]
                }
            }
            // 2 个回复
            if (parsed.length === 3) {
                cache = parsed[2]
                return JSON.parse(parsed[1])
            }
            // 正常回复
            if (parsed.length === 2) {
                // 没有回复完就暂存
                try {
                    return JSON.parse(parsed[1])
                } catch (error) {
                    cache = parsed[1]
                }
            }
        },
            filter((chunk) => chunk.length > 1, td.readable as unknown as AsyncIterable<string>)
        )
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