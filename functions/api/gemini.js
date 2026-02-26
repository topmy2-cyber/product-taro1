export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();

        // Gemini API 키 (Cloudflare Pages 환경 변수에 등록해야 함)
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        const model = body.model || "gemini-2.0-flash";
        
        // 표준 Gemini generateContent 엔드포인트 호출
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: body.contents,
                generationConfig: body.generationConfig
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return new Response(JSON.stringify({ 
                error: "Gemini API Error", 
                details: errorData.error || errorData 
            }), { 
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        const data = await response.json();

        // 성공 응답 반환 (표준 Gemini 응답 구조 그대로 전달)
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
