import { config } from "dotenv"
import { newSession } from './src';

const { parsed } = config()
const session = await newSession({
    key: parsed.KEY, secret: parsed.SECRET, onAskAns(things) {
        console.log(things);

    },
})

for await (const a of await session.ask("说说几个网红的名字")) {
    process.stdout.write(a)
}

for await (const a of await session.ask("那美国有吗呢？")) {
    process.stdout.write(a)
}

for await (const a of await session.ask("那英国呢？")) {
    process.stdout.write(a)
}
