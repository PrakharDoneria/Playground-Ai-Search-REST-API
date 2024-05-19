// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
/* Resolves after the given number of milliseconds. */ export function delay(ms, options = {}) {
    const { signal  } = options;
    if (signal?.aborted) {
        return Promise.reject(new DOMException("Delay was aborted.", "AbortError"));
    }
    return new Promise((resolve, reject)=>{
        const abort = ()=>{
            clearTimeout(i);
            reject(new DOMException("Delay was aborted.", "AbortError"));
        };
        const done = ()=>{
            signal?.removeEventListener("abort", abort);
            resolve();
        };
        const i = setTimeout(done, ms);
        signal?.addEventListener("abort", abort, {
            once: true
        });
    });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjExNC4wL2FzeW5jL2RlbGF5LnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5cbmV4cG9ydCBpbnRlcmZhY2UgRGVsYXlPcHRpb25zIHtcbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG59XG5cbi8qIFJlc29sdmVzIGFmdGVyIHRoZSBnaXZlbiBudW1iZXIgb2YgbWlsbGlzZWNvbmRzLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIsIG9wdGlvbnM6IERlbGF5T3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgc2lnbmFsIH0gPSBvcHRpb25zO1xuICBpZiAoc2lnbmFsPy5hYm9ydGVkKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJEZWxheSB3YXMgYWJvcnRlZC5cIiwgXCJBYm9ydEVycm9yXCIpKTtcbiAgfVxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk6IHZvaWQgPT4ge1xuICAgIGNvbnN0IGFib3J0ID0gKCkgPT4ge1xuICAgICAgY2xlYXJUaW1lb3V0KGkpO1xuICAgICAgcmVqZWN0KG5ldyBET01FeGNlcHRpb24oXCJEZWxheSB3YXMgYWJvcnRlZC5cIiwgXCJBYm9ydEVycm9yXCIpKTtcbiAgICB9O1xuICAgIGNvbnN0IGRvbmUgPSAoKSA9PiB7XG4gICAgICBzaWduYWw/LnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBhYm9ydCk7XG4gICAgICByZXNvbHZlKCk7XG4gICAgfTtcbiAgICBjb25zdCBpID0gc2V0VGltZW91dChkb25lLCBtcyk7XG4gICAgc2lnbmFsPy5hZGRFdmVudExpc3RlbmVyKFwiYWJvcnRcIiwgYWJvcnQsIHsgb25jZTogdHJ1ZSB9KTtcbiAgfSk7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBTTFFLG9EQUFvRCxHQUNwRCxPQUFPLFNBQVMsTUFBTSxFQUFVLEVBQUUsVUFBd0IsQ0FBQyxDQUFDLEVBQWlCO0lBQzNFLE1BQU0sRUFBRSxPQUFNLEVBQUUsR0FBRztJQUNuQixJQUFJLFFBQVEsU0FBUztRQUNuQixPQUFPLFFBQVEsTUFBTSxDQUFDLElBQUksYUFBYSxzQkFBc0I7SUFDL0QsQ0FBQztJQUNELE9BQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxTQUFpQjtRQUM1QyxNQUFNLFFBQVEsSUFBTTtZQUNsQixhQUFhO1lBQ2IsT0FBTyxJQUFJLGFBQWEsc0JBQXNCO1FBQ2hEO1FBQ0EsTUFBTSxPQUFPLElBQU07WUFDakIsUUFBUSxvQkFBb0IsU0FBUztZQUNyQztRQUNGO1FBQ0EsTUFBTSxJQUFJLFdBQVcsTUFBTTtRQUMzQixRQUFRLGlCQUFpQixTQUFTLE9BQU87WUFBRSxNQUFNLElBQUk7UUFBQztJQUN4RDtBQUNGLENBQUMifQ==