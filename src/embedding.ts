export const embedding = async (token: string, input: string) => {
    const res = await fetch(`https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/embedding-v1?access_token=${token}`, {
        method: "POST",
        body: JSON.stringify({
            input: [input]
        }),
        headers: {
            "Content-Type": "application/json",
            "x-bce-date": (new Date()).toISOString()
            // todo 计算 Authorization https://cloud.baidu.com/doc/Reference/s/hjwvz1y4f
        }
    })
    const jres = await res.json()

    return { embedding: jres.data.at(0).embedding, tokens: jres.usage.total_tokens }
}