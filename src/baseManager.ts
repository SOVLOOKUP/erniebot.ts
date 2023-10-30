import { z } from "zod"
import { MFunc, FuncInput, Json } from "./types"
import { mkFunc, login } from "./utils"

export class FunctionManager {
    #store: Map<string, MFunc>
    #funcs: Map<string, z.infer<z.ZodFunction<any, any>>>
    constructor() {
        this.#store = new Map<string, MFunc>()
        this.#funcs = new Map<string, z.infer<z.ZodFunction<any, any>>>()
    }
    funcsIter: () => IterableIterator<MFunc> | AsyncIterableIterator<MFunc> = () => this.#store.values()
    addFunc: <Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>>(func: FuncInput<Args, Returns>) => void | Promise<void> = (func) => {
        this.#store.set(func.name, mkFunc(func))
        this.#funcs.set(func.name, func.func)
    }
    delFunc: (name: string) => boolean | Promise<boolean> = (name) => {
        return this.#store.delete(name) && this.#funcs.delete(name)
    }
    invokeFunc: <Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>>(name: string, input: z.infer<Args>) => z.infer<Returns> | Promise<z.infer<Returns>>
        = async (name, input) => await this.#funcs.get(name)(input)
}

export class TokenManager {
    #store: Map<string, string>
    constructor() {
        this.#store = new Map<string, string>()
    }
    login: (key: string, secret: string) => Promise<void> = async (key: string, secret: string) => {
        this.#store.set(key, await login(key, secret))
    }
    get: (key: string) => Promise<string | undefined> | string | undefined = (key: string) => this.#store.get(key)
    del: (key: string) => Promise<boolean> | boolean = (key: string) => this.#store.delete(key)
}
