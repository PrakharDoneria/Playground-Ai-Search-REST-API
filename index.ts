import { serve } from "https://deno.land/std@0.114.0/http/server.ts";

const handler = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === "/search") {
        const query = url.searchParams.get("q");

        if (!query) {
            return new Response(JSON.stringify({ error: "Please provide a search query." }), { status: 400 });
        }

        const searchUrl = `https://playground.com/_next/data/DKheFsybTy-HQ-Exsbzy9/search.json?q=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(searchUrl);
            const responseData = await response.json();
            const data = responseData.pageProps.data;

            if (data && data.length > 0) {
                const firstResult = data[0];
                const result = {
                    title: firstResult.title || "N/A",
                    prompt: firstResult.prompt,
                    user: firstResult.user.displayName,
                    imageUrl: firstResult.url
                };

                return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
            } else {
                return new Response(JSON.stringify({ error: `No results found for "${query}".` }), { status: 404 });
            }
        } catch (error) {
            console.error("Error fetching search results:", error);
            return new Response(JSON.stringify({ error: "Sorry, an error occurred while fetching the search results." }), { status: 500 });
        }
    }

    return new Response("Not Found", { status: 404 });
};

// Start the HTTP server
console.log("HTTP webserver running. Access it at: http://localhost:8000/");
await serve(handler, { port: 8000 });
