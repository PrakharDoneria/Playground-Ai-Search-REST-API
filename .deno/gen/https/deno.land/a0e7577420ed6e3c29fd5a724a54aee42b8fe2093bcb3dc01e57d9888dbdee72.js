// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
// TODO(ry) It'd be better to make Deferred a class that inherits from
// Promise, rather than an interface. This is possible in ES2016, however
// typescript produces broken code when targeting ES5 code.
// See https://github.com/Microsoft/TypeScript/issues/15202
// At the time of writing, the github issue is closed but the problem remains.
/** Creates a Promise with the `reject` and `resolve` functions
 * placed as methods on the promise object itself. It allows you to do:
 *
 * ```ts
 *     import { deferred } from "./deferred.ts";
 *
 *     const p = deferred<number>();
 *     // ...
 *     p.resolve(42);
 * ```
 */ export function deferred() {
    let methods;
    let state = "pending";
    const promise = new Promise((resolve, reject)=>{
        methods = {
            async resolve (value) {
                await value;
                state = "fulfilled";
                resolve(value);
            },
            // deno-lint-ignore no-explicit-any
            reject (reason) {
                state = "rejected";
                reject(reason);
            }
        };
    });
    Object.defineProperty(promise, "state", {
        get: ()=>state
    });
    return Object.assign(promise, methods);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjExNC4wL2FzeW5jL2RlZmVycmVkLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBUT0RPKHJ5KSBJdCdkIGJlIGJldHRlciB0byBtYWtlIERlZmVycmVkIGEgY2xhc3MgdGhhdCBpbmhlcml0cyBmcm9tXG4vLyBQcm9taXNlLCByYXRoZXIgdGhhbiBhbiBpbnRlcmZhY2UuIFRoaXMgaXMgcG9zc2libGUgaW4gRVMyMDE2LCBob3dldmVyXG4vLyB0eXBlc2NyaXB0IHByb2R1Y2VzIGJyb2tlbiBjb2RlIHdoZW4gdGFyZ2V0aW5nIEVTNSBjb2RlLlxuLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9NaWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMTUyMDJcbi8vIEF0IHRoZSB0aW1lIG9mIHdyaXRpbmcsIHRoZSBnaXRodWIgaXNzdWUgaXMgY2xvc2VkIGJ1dCB0aGUgcHJvYmxlbSByZW1haW5zLlxuZXhwb3J0IGludGVyZmFjZSBEZWZlcnJlZDxUPiBleHRlbmRzIFByb21pc2U8VD4ge1xuICByZWFkb25seSBzdGF0ZTogXCJwZW5kaW5nXCIgfCBcImZ1bGZpbGxlZFwiIHwgXCJyZWplY3RlZFwiO1xuICByZXNvbHZlKHZhbHVlPzogVCB8IFByb21pc2VMaWtlPFQ+KTogdm9pZDtcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgcmVqZWN0KHJlYXNvbj86IGFueSk6IHZvaWQ7XG59XG5cbi8qKiBDcmVhdGVzIGEgUHJvbWlzZSB3aXRoIHRoZSBgcmVqZWN0YCBhbmQgYHJlc29sdmVgIGZ1bmN0aW9uc1xuICogcGxhY2VkIGFzIG1ldGhvZHMgb24gdGhlIHByb21pc2Ugb2JqZWN0IGl0c2VsZi4gSXQgYWxsb3dzIHlvdSB0byBkbzpcbiAqXG4gKiBgYGB0c1xuICogICAgIGltcG9ydCB7IGRlZmVycmVkIH0gZnJvbSBcIi4vZGVmZXJyZWQudHNcIjtcbiAqXG4gKiAgICAgY29uc3QgcCA9IGRlZmVycmVkPG51bWJlcj4oKTtcbiAqICAgICAvLyAuLi5cbiAqICAgICBwLnJlc29sdmUoNDIpO1xuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcnJlZDxUPigpOiBEZWZlcnJlZDxUPiB7XG4gIGxldCBtZXRob2RzO1xuICBsZXQgc3RhdGUgPSBcInBlbmRpbmdcIjtcbiAgY29uc3QgcHJvbWlzZSA9IG5ldyBQcm9taXNlPFQ+KChyZXNvbHZlLCByZWplY3QpOiB2b2lkID0+IHtcbiAgICBtZXRob2RzID0ge1xuICAgICAgYXN5bmMgcmVzb2x2ZSh2YWx1ZTogVCB8IFByb21pc2VMaWtlPFQ+KSB7XG4gICAgICAgIGF3YWl0IHZhbHVlO1xuICAgICAgICBzdGF0ZSA9IFwiZnVsZmlsbGVkXCI7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSxcbiAgICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgICByZWplY3QocmVhc29uPzogYW55KSB7XG4gICAgICAgIHN0YXRlID0gXCJyZWplY3RlZFwiO1xuICAgICAgICByZWplY3QocmVhc29uKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfSk7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShwcm9taXNlLCBcInN0YXRlXCIsIHsgZ2V0OiAoKSA9PiBzdGF0ZSB9KTtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJvbWlzZSwgbWV0aG9kcykgYXMgRGVmZXJyZWQ8VD47XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLHNFQUFzRTtBQUN0RSx5RUFBeUU7QUFDekUsMkRBQTJEO0FBQzNELDJEQUEyRDtBQUMzRCw4RUFBOEU7QUFROUU7Ozs7Ozs7Ozs7Q0FVQyxHQUNELE9BQU8sU0FBUyxXQUEyQjtJQUN6QyxJQUFJO0lBQ0osSUFBSSxRQUFRO0lBQ1osTUFBTSxVQUFVLElBQUksUUFBVyxDQUFDLFNBQVMsU0FBaUI7UUFDeEQsVUFBVTtZQUNSLE1BQU0sU0FBUSxLQUF5QixFQUFFO2dCQUN2QyxNQUFNO2dCQUNOLFFBQVE7Z0JBQ1IsUUFBUTtZQUNWO1lBQ0EsbUNBQW1DO1lBQ25DLFFBQU8sTUFBWSxFQUFFO2dCQUNuQixRQUFRO2dCQUNSLE9BQU87WUFDVDtRQUNGO0lBQ0Y7SUFDQSxPQUFPLGNBQWMsQ0FBQyxTQUFTLFNBQVM7UUFBRSxLQUFLLElBQU07SUFBTTtJQUMzRCxPQUFPLE9BQU8sTUFBTSxDQUFDLFNBQVM7QUFDaEMsQ0FBQyJ9