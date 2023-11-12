import type { Plugin } from "../src";

const plugin: Plugin = (opt) => {
    console.log("文心一言测试插件");
    opt.setAskAnsHook((aa) => {
        console.log(aa);
    })
} 

export default plugin