import { newBaseSession } from "./src"
import { config } from "dotenv"

const { parsed } = config()
const b = await newBaseSession(parsed.KEY, parsed.SECRET)

for await (const a of await b.ms.ask("说说几个网红的名字")) {
    process.stdout.write(a)
}

for await (const a of await b.ms.ask("那美国有吗呢？")) {
    process.stdout.write(a)
}

for await (const a of await b.ms.ask("那英国呢？")) {
    process.stdout.write(a)
}

