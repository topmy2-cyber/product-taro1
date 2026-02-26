export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();

        // Gemini API 키 (Cloudflare Pages 환경 변수에 등록해야 함)
        const apiKey = env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY environment variable" }), { 
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 구글 Gemini API 엔드포인트 (v1beta generateContent)
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        // 구글 API에 보낼 최종 페이로드 구성
        const googlePayload = {
            contents: body.contents,
            generationConfig: body.generationConfig
        };

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(googlePayload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            return new Response(JSON.stringify({ 
                error: "Gemini API Error", 
                details: errorData.error || errorData 
            }), { 
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        const data = await response.json();

        // 성공 응답 반환
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: "Internal Server Error", message: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
