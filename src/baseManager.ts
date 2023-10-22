import { z } from "zod"
import { MFunc, FuncInput, Json } from "./types"
import { mkFunc, login } from "./utils"

export class FunctionManager {
    #store: Map<string, MFunc>
    constructor() {
        this.#store = new Map<string, MFunc>()
    }
    funcsIter: () => IterableIterator<MFunc> | AsyncIterableIterator<MFunc> = () => this.#store.values()
    addFunc: <Args extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>, Returns extends z.ZodObject<{ [key: string]: z.ZodType<Json> }>>(func: FuncInput<Args, Returns>) => void | Promise<void> = (func) => {
        this.#store.set(func.name, mkFunc(func))
    }
    delFunc: (name: string) => boolean | Promise<boolean> = (name) => this.#store.delete(name)
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