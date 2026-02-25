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

        // Gemini API 호출 (Interactions API)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Gemini API Error: ${errorData}`);
        }

        const data = await response.json();

        // 성공 응답 반환
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
