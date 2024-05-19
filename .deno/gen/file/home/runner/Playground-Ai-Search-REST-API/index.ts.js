import { serve } from "https://deno.land/std@0.114.0/http/server.ts";
// Define the handler function for incoming requests
const handler = async (request)=>{
    const url = new URL(request.url);
    if (url.pathname === "/search") {
        const query = url.searchParams.get("q");
        if (!query) {
            return new Response(JSON.stringify({
                error: "Please provide a search query."
            }), {
                status: 400
            });
        }
        const searchUrl = `https://playground.com/_next/data/ba0kOy0FZsenBfbBIZHrR/search.json?q=${encodeURIComponent(query)}`;
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
                return new Response(JSON.stringify(result), {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json"
                    }
                });
            } else {
                return new Response(JSON.stringify({
                    error: `No results found for "${query}".`
                }), {
                    status: 404
                });
            }
        } catch (error) {
            console.error("Error fetching search results:", error);
            return new Response(JSON.stringify({
                error: "Sorry, an error occurred while fetching the search results."
            }), {
                status: 500
            });
        }
    }
    return new Response("Not Found", {
        status: 404
    });
};
// Start the HTTP server
console.log("HTTP webserver running. Access it at: http://localhost:8000/");
await serve(handler, {
    port: 8000
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vaG9tZS9ydW5uZXIvUGxheWdyb3VuZC1BaS1TZWFyY2gtUkVTVC1BUEkvaW5kZXgudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgc2VydmUgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQDAuMTE0LjAvaHR0cC9zZXJ2ZXIudHNcIjtcblxuLy8gRGVmaW5lIHRoZSBoYW5kbGVyIGZ1bmN0aW9uIGZvciBpbmNvbWluZyByZXF1ZXN0c1xuY29uc3QgaGFuZGxlciA9IGFzeW5jIChyZXF1ZXN0OiBSZXF1ZXN0KTogUHJvbWlzZTxSZXNwb25zZT4gPT4ge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwocmVxdWVzdC51cmwpO1xuXG4gICAgaWYgKHVybC5wYXRobmFtZSA9PT0gXCIvc2VhcmNoXCIpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSB1cmwuc2VhcmNoUGFyYW1zLmdldChcInFcIik7XG5cbiAgICAgICAgaWYgKCFxdWVyeSkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlBsZWFzZSBwcm92aWRlIGEgc2VhcmNoIHF1ZXJ5LlwiIH0pLCB7IHN0YXR1czogNDAwIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2VhcmNoVXJsID0gYGh0dHBzOi8vcGxheWdyb3VuZC5jb20vX25leHQvZGF0YS9iYTBrT3kwRlpzZW5CZmJCSVpIclIvc2VhcmNoLmpzb24/cT0ke2VuY29kZVVSSUNvbXBvbmVudChxdWVyeSl9YDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChzZWFyY2hVcmwpO1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2VEYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgICAgICAgICAgY29uc3QgZGF0YSA9IHJlc3BvbnNlRGF0YS5wYWdlUHJvcHMuZGF0YTtcblxuICAgICAgICAgICAgaWYgKGRhdGEgJiYgZGF0YS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZmlyc3RSZXN1bHQgPSBkYXRhWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IGZpcnN0UmVzdWx0LnRpdGxlIHx8IFwiTi9BXCIsXG4gICAgICAgICAgICAgICAgICAgIHByb21wdDogZmlyc3RSZXN1bHQucHJvbXB0LFxuICAgICAgICAgICAgICAgICAgICB1c2VyOiBmaXJzdFJlc3VsdC51c2VyLmRpc3BsYXlOYW1lLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZVVybDogZmlyc3RSZXN1bHQudXJsXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkocmVzdWx0KSwgeyBzdGF0dXM6IDIwMCwgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL2pzb25cIiB9IH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJlc3BvbnNlKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6IGBObyByZXN1bHRzIGZvdW5kIGZvciBcIiR7cXVlcnl9XCIuYCB9KSwgeyBzdGF0dXM6IDQwNCB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJFcnJvciBmZXRjaGluZyBzZWFyY2ggcmVzdWx0czpcIiwgZXJyb3IpO1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBSZXNwb25zZShKU09OLnN0cmluZ2lmeSh7IGVycm9yOiBcIlNvcnJ5LCBhbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyB0aGUgc2VhcmNoIHJlc3VsdHMuXCIgfSksIHsgc3RhdHVzOiA1MDAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlc3BvbnNlKFwiTm90IEZvdW5kXCIsIHsgc3RhdHVzOiA0MDQgfSk7XG59O1xuXG4vLyBTdGFydCB0aGUgSFRUUCBzZXJ2ZXJcbmNvbnNvbGUubG9nKFwiSFRUUCB3ZWJzZXJ2ZXIgcnVubmluZy4gQWNjZXNzIGl0IGF0OiBodHRwOi8vbG9jYWxob3N0OjgwMDAvXCIpO1xuYXdhaXQgc2VydmUoaGFuZGxlciwgeyBwb3J0OiA4MDAwIH0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFNBQVMsS0FBSyxRQUFRLCtDQUErQztBQUVyRSxvREFBb0Q7QUFDcEQsTUFBTSxVQUFVLE9BQU8sVUFBd0M7SUFDM0QsTUFBTSxNQUFNLElBQUksSUFBSSxRQUFRLEdBQUc7SUFFL0IsSUFBSSxJQUFJLFFBQVEsS0FBSyxXQUFXO1FBQzVCLE1BQU0sUUFBUSxJQUFJLFlBQVksQ0FBQyxHQUFHLENBQUM7UUFFbkMsSUFBSSxDQUFDLE9BQU87WUFDUixPQUFPLElBQUksU0FBUyxLQUFLLFNBQVMsQ0FBQztnQkFBRSxPQUFPO1lBQWlDLElBQUk7Z0JBQUUsUUFBUTtZQUFJO1FBQ25HLENBQUM7UUFFRCxNQUFNLFlBQVksQ0FBQyxzRUFBc0UsRUFBRSxtQkFBbUIsT0FBTyxDQUFDO1FBRXRILElBQUk7WUFDQSxNQUFNLFdBQVcsTUFBTSxNQUFNO1lBQzdCLE1BQU0sZUFBZSxNQUFNLFNBQVMsSUFBSTtZQUN4QyxNQUFNLE9BQU8sYUFBYSxTQUFTLENBQUMsSUFBSTtZQUV4QyxJQUFJLFFBQVEsS0FBSyxNQUFNLEdBQUcsR0FBRztnQkFDekIsTUFBTSxjQUFjLElBQUksQ0FBQyxFQUFFO2dCQUMzQixNQUFNLFNBQVM7b0JBQ1gsT0FBTyxZQUFZLEtBQUssSUFBSTtvQkFDNUIsUUFBUSxZQUFZLE1BQU07b0JBQzFCLE1BQU0sWUFBWSxJQUFJLENBQUMsV0FBVztvQkFDbEMsVUFBVSxZQUFZLEdBQUc7Z0JBQzdCO2dCQUVBLE9BQU8sSUFBSSxTQUFTLEtBQUssU0FBUyxDQUFDLFNBQVM7b0JBQUUsUUFBUTtvQkFBSyxTQUFTO3dCQUFFLGdCQUFnQjtvQkFBbUI7Z0JBQUU7WUFDL0csT0FBTztnQkFDSCxPQUFPLElBQUksU0FBUyxLQUFLLFNBQVMsQ0FBQztvQkFBRSxPQUFPLENBQUMsc0JBQXNCLEVBQUUsTUFBTSxFQUFFLENBQUM7Z0JBQUMsSUFBSTtvQkFBRSxRQUFRO2dCQUFJO1lBQ3JHLENBQUM7UUFDTCxFQUFFLE9BQU8sT0FBTztZQUNaLFFBQVEsS0FBSyxDQUFDLGtDQUFrQztZQUNoRCxPQUFPLElBQUksU0FBUyxLQUFLLFNBQVMsQ0FBQztnQkFBRSxPQUFPO1lBQThELElBQUk7Z0JBQUUsUUFBUTtZQUFJO1FBQ2hJO0lBQ0osQ0FBQztJQUVELE9BQU8sSUFBSSxTQUFTLGFBQWE7UUFBRSxRQUFRO0lBQUk7QUFDbkQ7QUFFQSx3QkFBd0I7QUFDeEIsUUFBUSxHQUFHLENBQUM7QUFDWixNQUFNLE1BQU0sU0FBUztJQUFFLE1BQU07QUFBSyJ9