// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.
import { delay } from "../async/mod.ts";
/** Thrown by Server after it has been closed. */ const ERROR_SERVER_CLOSED = "Server closed";
/** Thrown when parsing an invalid address string. */ const ERROR_ADDRESS_INVALID = "Invalid address";
/** Default port for serving HTTP. */ const HTTP_PORT = 80;
/** Default port for serving HTTPS. */ const HTTPS_PORT = 443;
/** Initial backoff delay of 5ms following a temporary accept failure. */ const INITIAL_ACCEPT_BACKOFF_DELAY = 5;
/** Max backoff delay of 1s following a temporary accept failure. */ const MAX_ACCEPT_BACKOFF_DELAY = 1000;
/**
 * Parse an address from a string.
 *
 * Throws a `TypeError` when the address is invalid.
 *
 * ```ts
 * import { _parseAddrFromStr } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = "::1:8000";
 * const listenOptions = _parseAddrFromStr(addr);
 * ```
 *
 * @param addr The address string to parse.
 * @param defaultPort Default port when not included in the address string.
 * @return The parsed address.
 */ export function _parseAddrFromStr(addr, defaultPort = HTTP_PORT) {
    const host = addr.startsWith(":") ? `0.0.0.0${addr}` : addr;
    let url;
    try {
        url = new URL(`http://${host}`);
    } catch  {
        throw new TypeError(ERROR_ADDRESS_INVALID);
    }
    if (url.username || url.password || url.pathname != "/" || url.search || url.hash) {
        throw new TypeError(ERROR_ADDRESS_INVALID);
    }
    return {
        hostname: url.hostname,
        port: url.port === "" ? defaultPort : Number(url.port)
    };
}
/** Used to construct an HTTP server. */ export class Server {
    #addr;
    #handler;
    #closed = false;
    #listeners = new Set();
    #httpConnections = new Set();
    /**
   * Constructs a new HTTP Server instance.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   * ```
   *
   * @param serverInit Options for running an HTTP server.
   */ constructor(serverInit){
        this.#addr = serverInit.addr;
        this.#handler = serverInit.handler;
    }
    /**
   * Accept incoming connections on the given listener, and handle requests on
   * these connections with the given handler.
   *
   * HTTP/2 support is only enabled if the provided Deno.Listener returns TLS
   * connections and was configured with "h2" in the ALPN protocols.
   *
   * Throws a server closed error if called after the server has been closed.
   *
   * Will always close the created listener.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ handler });
   * const listener = Deno.listen({ port: 4505 });
   *
   * console.log("server listening on http://localhost:4505");
   *
   * await server.serve(listener);
   * ```
   *
   * @param listener The listener to accept connections from.
   */ async serve(listener) {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        this.#trackListener(listener);
        try {
            return await this.#accept(listener);
        } finally{
            this.#untrackListener(listener);
            try {
                listener.close();
            } catch  {
            // Listener has already been closed.
            }
        }
    }
    /**
   * Create a listener on the server, accept incoming connections, and handle
   * requests on these connections with the given handler.
   *
   * If the server was constructed with the port omitted from the address, `:80`
   * is used.
   *
   * If the server was constructed with the host omitted from the address, the
   * non-routable meta-address `0.0.0.0` is used.
   *
   * Throws a server closed error if the server has been closed.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   *
   * console.log("server listening on http://localhost:4505");
   *
   * await server.listenAndServe();
   * ```
   */ async listenAndServe() {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        const addr = this.#addr ?? `:${HTTP_PORT}`;
        const listenOptions = _parseAddrFromStr(addr, HTTP_PORT);
        const listener = Deno.listen({
            ...listenOptions,
            transport: "tcp"
        });
        return await this.serve(listener);
    }
    /**
   * Create a listener on the server, accept incoming connections, upgrade them
   * to TLS, and handle requests on these connections with the given handler.
   *
   * If the server was constructed with the port omitted from the address, `:443`
   * is used.
   *
   * If the server was constructed with the host omitted from the address, the
   * non-routable meta-address `0.0.0.0` is used.
   *
   * Throws a server closed error if the server has been closed.
   *
   * ```ts
   * import { Server } from "https://deno.land/std@$STD_VERSION/http/server.ts";
   *
   * const addr = ":4505";
   * const handler = (request: Request) => {
   *   const body = `Your user-agent is:\n\n${request.headers.get(
   *    "user-agent",
   *   ) ?? "Unknown"}`;
   *
   *   return new Response(body, { status: 200 });
   * };
   *
   * const server = new Server({ addr, handler });
   *
   * const certFile = "/path/to/certFile.crt";
   * const keyFile = "/path/to/keyFile.key";
   *
   * console.log("server listening on https://localhost:4505");
   *
   * await server.listenAndServeTls(certFile, keyFile);
   * ```
   *
   * @param certFile The path to the file containing the TLS certificate.
   * @param keyFile The path to the file containing the TLS private key.
   */ async listenAndServeTls(certFile, keyFile) {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        const addr = this.#addr ?? `:${HTTPS_PORT}`;
        const listenOptions = _parseAddrFromStr(addr, HTTPS_PORT);
        const listener = Deno.listenTls({
            ...listenOptions,
            certFile,
            keyFile,
            transport: "tcp"
        });
        return await this.serve(listener);
    }
    /**
   * Immediately close the server listeners and associated HTTP connections.
   *
   * Throws a server closed error if called after the server has been closed.
   */ close() {
        if (this.#closed) {
            throw new Deno.errors.Http(ERROR_SERVER_CLOSED);
        }
        this.#closed = true;
        for (const listener of this.#listeners){
            try {
                listener.close();
            } catch  {
            // Listener has already been closed.
            }
        }
        this.#listeners.clear();
        for (const httpConn of this.#httpConnections){
            this.#closeHttpConn(httpConn);
        }
        this.#httpConnections.clear();
    }
    /** Get whether the server is closed. */ get closed() {
        return this.#closed;
    }
    /** Get the list of network addresses the server is listening on. */ get addrs() {
        return Array.from(this.#listeners).map((listener)=>listener.addr);
    }
    /**
   * Responds to an HTTP request.
   *
   * @param requestEvent The HTTP request to respond to.
   * @param httpCon The HTTP connection to yield requests from.
   * @param connInfo Information about the underlying connection.
   */ async #respond(requestEvent, httpConn, connInfo) {
        try {
            // Handle the request event, generating a response.
            const response = await this.#handler(requestEvent.request, connInfo);
            // Send the response.
            await requestEvent.respondWith(response);
        } catch  {
            // If the handler throws then it is assumed that the impact of the error
            // is isolated to the individual request, so we close the connection.
            //
            // Alternatively the connection has already been closed, or there is some
            // other error with responding on this connection that prompts us to
            // close it and open a new connection.
            return this.#closeHttpConn(httpConn);
        }
    }
    /**
   * Serves all HTTP requests on a single connection.
   *
   * @param httpConn The HTTP connection to yield requests from.
   * @param connInfo Information about the underlying connection.
   */ async #serveHttp(httpConn, connInfo) {
        while(!this.#closed){
            let requestEvent;
            try {
                // Yield the new HTTP request on the connection.
                requestEvent = await httpConn.nextRequest();
            } catch  {
                break;
            }
            if (requestEvent === null) {
                break;
            }
            // Respond to the request. Note we do not await this async method to
            // allow the connection to handle multiple requests in the case of h2.
            this.#respond(requestEvent, httpConn, connInfo);
        }
        this.#closeHttpConn(httpConn);
    }
    /**
   * Accepts all connections on a single network listener.
   *
   * @param listener The listener to accept connections from.
   */ async #accept(listener) {
        let acceptBackoffDelay;
        while(!this.#closed){
            let conn;
            try {
                // Wait for a new connection.
                conn = await listener.accept();
            } catch (error) {
                if (// The listener is closed.
                error instanceof Deno.errors.BadResource || // TLS handshake errors.
                error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof || error instanceof Deno.errors.ConnectionReset || error instanceof Deno.errors.NotConnected) {
                    // Backoff after transient errors to allow time for the system to
                    // recover, and avoid blocking up the event loop with a continuously
                    // running loop.
                    if (!acceptBackoffDelay) {
                        acceptBackoffDelay = INITIAL_ACCEPT_BACKOFF_DELAY;
                    } else {
                        acceptBackoffDelay *= 2;
                    }
                    if (acceptBackoffDelay >= MAX_ACCEPT_BACKOFF_DELAY) {
                        acceptBackoffDelay = MAX_ACCEPT_BACKOFF_DELAY;
                    }
                    await delay(acceptBackoffDelay);
                    continue;
                }
                throw error;
            }
            acceptBackoffDelay = undefined;
            // "Upgrade" the network connection into an HTTP connection.
            let httpConn;
            try {
                httpConn = Deno.serveHttp(conn);
            } catch  {
                continue;
            }
            // Closing the underlying listener will not close HTTP connections, so we
            // track for closure upon server close.
            this.#trackHttpConnection(httpConn);
            const connInfo = {
                localAddr: conn.localAddr,
                remoteAddr: conn.remoteAddr
            };
            // Serve the requests that arrive on the just-accepted connection. Note
            // we do not await this async method to allow the server to accept new
            // connections.
            this.#serveHttp(httpConn, connInfo);
        }
    }
    /**
   * Untracks and closes an HTTP connection.
   *
   * @param httpConn The HTTP connection to close.
   */ #closeHttpConn(httpConn) {
        this.#untrackHttpConnection(httpConn);
        try {
            httpConn.close();
        } catch  {
        // Connection has already been closed.
        }
    }
    /**
   * Adds the listener to the internal tracking list.
   *
   * @param listener Listener to track.
   */ #trackListener(listener) {
        this.#listeners.add(listener);
    }
    /**
   * Removes the listener from the internal tracking list.
   *
   * @param listener Listener to untrack.
   */ #untrackListener(listener) {
        this.#listeners.delete(listener);
    }
    /**
   * Adds the HTTP connection to the internal tracking list.
   *
   * @param httpConn HTTP connection to track.
   */ #trackHttpConnection(httpConn) {
        this.#httpConnections.add(httpConn);
    }
    /**
   * Removes the HTTP connection from the internal tracking list.
   *
   * @param httpConn HTTP connection to untrack.
   */ #untrackHttpConnection(httpConn) {
        this.#httpConnections.delete(httpConn);
    }
}
/**
 * Constructs a server, accepts incoming connections on the given listener, and
 * handles requests on these connections with the given handler.
 *
 * ```ts
 * import { serveListener } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const listener = Deno.listen({ port: 4505 });
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await serveListener(listener, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param listener The listener to accept connections from.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */ export async function serveListener(listener, handler, options) {
    const server = new Server({
        handler
    });
    if (options?.signal) {
        options.signal.onabort = ()=>server.close();
    }
    return await server.serve(listener);
}
/** Serves HTTP requests with the given handler.
 *
 * You can specifies `addr` option, which is the address to listen on,
 * in the form "host:port". The default is "0.0.0.0:8000".
 *
 * The below example serves with the port 8000.
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * serve((_req) => new Response("Hello, world"));
 * ```
 *
 * You can change the listening address by `addr` option. The below example
 * serves with the port 3000.
 *
 * ```ts
 * import { serve } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * console.log("server is starting at localhost:3000");
 * serve((_req) => new Response("Hello, world"), { addr: ":3000" });
 * ```
 *
 * @param handler The handler for individual HTTP requests.
 * @param options The options. See `ServeInit` documentation for details.
 */ export async function serve(handler, options = {}) {
    const addr = options.addr ?? ":8000";
    const server = new Server({
        addr,
        handler
    });
    if (options?.signal) {
        options.signal.onabort = ()=>server.close();
    }
    return await server.listenAndServe();
}
/** Serves HTTPS requests with the given handler.
 *
 * You must specify `keyFile` and `certFile` options.
 *
 * You can specifies `addr` option, which is the address to listen on,
 * in the form "host:port". The default is "0.0.0.0:8443".
 *
 * The below example serves with the default port 8443.
 *
 * ```ts
 * import { serveTls } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 * const certFile = "/path/to/certFile.crt";
 * const keyFile = "/path/to/keyFile.key";
 * console.log("server is starting at https://localhost:8443");
 * serveTls((_req) => new Response("Hello, world"), { certFile, keyFile });
 * ```
 *
 * @param handler The handler for individual HTTPS requests.
 * @param options The options. See `ServeTlsInit` documentation for details.
 * @returns
 */ export async function serveTls(handler, options) {
    if (!options.keyFile) {
        throw new Error("TLS config is given, but 'keyFile' is missing.");
    }
    if (!options.certFile) {
        throw new Error("TLS config is given, but 'certFile' is missing.");
    }
    const addr = options.addr ?? ":8443";
    const server = new Server({
        addr,
        handler
    });
    if (options?.signal) {
        options.signal.onabort = ()=>server.close();
    }
    return await server.listenAndServeTls(options.certFile, options.keyFile);
}
/**
 * @deprecated Use `serve` instead.
 *
 * Constructs a server, creates a listener on the given address, accepts
 * incoming connections, and handles requests on these connections with the
 * given handler.
 *
 * If the port is omitted from the address, `:80` is used.
 *
 * If the host is omitted from the address, the non-routable meta-address
 * `0.0.0.0` is used.
 *
 * ```ts
 * import { listenAndServe } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = ":4505";
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await listenAndServe(addr, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param addr The address to listen on.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */ export async function listenAndServe(addr, handler, options) {
    const server = new Server({
        addr,
        handler
    });
    if (options?.signal) {
        options.signal.onabort = ()=>server.close();
    }
    return await server.listenAndServe();
}
/**
 * @deprecated Use `serveTls` instead.
 *
 * Constructs a server, creates a listener on the given address, accepts
 * incoming connections, upgrades them to TLS, and handles requests on these
 * connections with the given handler.
 *
 * If the port is omitted from the address, `:443` is used.
 *
 * If the host is omitted from the address, the non-routable meta-address
 * `0.0.0.0` is used.
 *
 * ```ts
 * import { listenAndServeTls } from "https://deno.land/std@$STD_VERSION/http/server.ts";
 *
 * const addr = ":4505";
 * const certFile = "/path/to/certFile.crt";
 * const keyFile = "/path/to/keyFile.key";
 *
 * console.log("server listening on http://localhost:4505");
 *
 * await listenAndServeTls(addr, certFile, keyFile, (request) => {
 *   const body = `Your user-agent is:\n\n${request.headers.get(
 *     "user-agent",
 *   ) ?? "Unknown"}`;
 *
 *   return new Response(body, { status: 200 });
 * });
 * ```
 *
 * @param addr The address to listen on.
 * @param certFile The path to the file containing the TLS certificate.
 * @param keyFile The path to the file containing the TLS private key.
 * @param handler The handler for individual HTTP requests.
 * @param options Optional serve options.
 */ export async function listenAndServeTls(addr, certFile, keyFile, handler, options) {
    const server = new Server({
        addr,
        handler
    });
    if (options?.signal) {
        options.signal.onabort = ()=>server.close();
    }
    return await server.listenAndServeTls(certFile, keyFile);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjExNC4wL2h0dHAvc2VydmVyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjEgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBkZWxheSB9IGZyb20gXCIuLi9hc3luYy9tb2QudHNcIjtcblxuLyoqIFRocm93biBieSBTZXJ2ZXIgYWZ0ZXIgaXQgaGFzIGJlZW4gY2xvc2VkLiAqL1xuY29uc3QgRVJST1JfU0VSVkVSX0NMT1NFRCA9IFwiU2VydmVyIGNsb3NlZFwiO1xuXG4vKiogVGhyb3duIHdoZW4gcGFyc2luZyBhbiBpbnZhbGlkIGFkZHJlc3Mgc3RyaW5nLiAqL1xuY29uc3QgRVJST1JfQUREUkVTU19JTlZBTElEID0gXCJJbnZhbGlkIGFkZHJlc3NcIjtcblxuLyoqIERlZmF1bHQgcG9ydCBmb3Igc2VydmluZyBIVFRQLiAqL1xuY29uc3QgSFRUUF9QT1JUID0gODA7XG5cbi8qKiBEZWZhdWx0IHBvcnQgZm9yIHNlcnZpbmcgSFRUUFMuICovXG5jb25zdCBIVFRQU19QT1JUID0gNDQzO1xuXG4vKiogSW5pdGlhbCBiYWNrb2ZmIGRlbGF5IG9mIDVtcyBmb2xsb3dpbmcgYSB0ZW1wb3JhcnkgYWNjZXB0IGZhaWx1cmUuICovXG5jb25zdCBJTklUSUFMX0FDQ0VQVF9CQUNLT0ZGX0RFTEFZID0gNTtcblxuLyoqIE1heCBiYWNrb2ZmIGRlbGF5IG9mIDFzIGZvbGxvd2luZyBhIHRlbXBvcmFyeSBhY2NlcHQgZmFpbHVyZS4gKi9cbmNvbnN0IE1BWF9BQ0NFUFRfQkFDS09GRl9ERUxBWSA9IDEwMDA7XG5cbi8qKiBJbmZvcm1hdGlvbiBhYm91dCB0aGUgY29ubmVjdGlvbiBhIHJlcXVlc3QgYXJyaXZlZCBvbi4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubkluZm8ge1xuICAvKiogVGhlIGxvY2FsIGFkZHJlc3Mgb2YgdGhlIGNvbm5lY3Rpb24uICovXG4gIHJlYWRvbmx5IGxvY2FsQWRkcjogRGVuby5BZGRyO1xuICAvKiogVGhlIHJlbW90ZSBhZGRyZXNzIG9mIHRoZSBjb25uZWN0aW9uLiAqL1xuICByZWFkb25seSByZW1vdGVBZGRyOiBEZW5vLkFkZHI7XG59XG5cbi8qKlxuICogQSBoYW5kbGVyIGZvciBIVFRQIHJlcXVlc3RzLiBDb25zdW1lcyBhIHJlcXVlc3QgYW5kIGNvbm5lY3Rpb24gaW5mb3JtYXRpb25cbiAqIGFuZCByZXR1cm5zIGEgcmVzcG9uc2UuXG4gKlxuICogSWYgYSBoYW5kbGVyIHRocm93cywgdGhlIHNlcnZlciBjYWxsaW5nIHRoZSBoYW5kbGVyIHdpbGwgYXNzdW1lIHRoZSBpbXBhY3RcbiAqIG9mIHRoZSBlcnJvciBpcyBpc29sYXRlZCB0byB0aGUgaW5kaXZpZHVhbCByZXF1ZXN0LiBJdCB3aWxsIGNhdGNoIHRoZSBlcnJvclxuICogYW5kIGNsb3NlIHRoZSB1bmRlcmx5aW5nIGNvbm5lY3Rpb24uXG4gKi9cbmV4cG9ydCB0eXBlIEhhbmRsZXIgPSAoXG4gIHJlcXVlc3Q6IFJlcXVlc3QsXG4gIGNvbm5JbmZvOiBDb25uSW5mbyxcbikgPT4gUmVzcG9uc2UgfCBQcm9taXNlPFJlc3BvbnNlPjtcblxuLyoqXG4gKiBQYXJzZSBhbiBhZGRyZXNzIGZyb20gYSBzdHJpbmcuXG4gKlxuICogVGhyb3dzIGEgYFR5cGVFcnJvcmAgd2hlbiB0aGUgYWRkcmVzcyBpcyBpbnZhbGlkLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBfcGFyc2VBZGRyRnJvbVN0ciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gKlxuICogY29uc3QgYWRkciA9IFwiOjoxOjgwMDBcIjtcbiAqIGNvbnN0IGxpc3Rlbk9wdGlvbnMgPSBfcGFyc2VBZGRyRnJvbVN0cihhZGRyKTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBhZGRyIFRoZSBhZGRyZXNzIHN0cmluZyB0byBwYXJzZS5cbiAqIEBwYXJhbSBkZWZhdWx0UG9ydCBEZWZhdWx0IHBvcnQgd2hlbiBub3QgaW5jbHVkZWQgaW4gdGhlIGFkZHJlc3Mgc3RyaW5nLlxuICogQHJldHVybiBUaGUgcGFyc2VkIGFkZHJlc3MuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBfcGFyc2VBZGRyRnJvbVN0cihcbiAgYWRkcjogc3RyaW5nLFxuICBkZWZhdWx0UG9ydCA9IEhUVFBfUE9SVCxcbik6IERlbm8uTGlzdGVuT3B0aW9ucyB7XG4gIGNvbnN0IGhvc3QgPSBhZGRyLnN0YXJ0c1dpdGgoXCI6XCIpID8gYDAuMC4wLjAke2FkZHJ9YCA6IGFkZHI7XG5cbiAgbGV0IHVybDogVVJMO1xuXG4gIHRyeSB7XG4gICAgdXJsID0gbmV3IFVSTChgaHR0cDovLyR7aG9zdH1gKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihFUlJPUl9BRERSRVNTX0lOVkFMSUQpO1xuICB9XG5cbiAgaWYgKFxuICAgIHVybC51c2VybmFtZSB8fFxuICAgIHVybC5wYXNzd29yZCB8fFxuICAgIHVybC5wYXRobmFtZSAhPSBcIi9cIiB8fFxuICAgIHVybC5zZWFyY2ggfHxcbiAgICB1cmwuaGFzaFxuICApIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKEVSUk9SX0FERFJFU1NfSU5WQUxJRCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGhvc3RuYW1lOiB1cmwuaG9zdG5hbWUsXG4gICAgcG9ydDogdXJsLnBvcnQgPT09IFwiXCIgPyBkZWZhdWx0UG9ydCA6IE51bWJlcih1cmwucG9ydCksXG4gIH07XG59XG5cbi8qKiBPcHRpb25zIGZvciBydW5uaW5nIGFuIEhUVFAgc2VydmVyLiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXJ2ZXJJbml0IHtcbiAgLyoqXG4gICAqIE9wdGlvbmFsbHkgc3BlY2lmaWVzIHRoZSBhZGRyZXNzIHRvIGxpc3RlbiBvbiwgaW4gdGhlIGZvcm1cbiAgICogXCJob3N0OnBvcnRcIi5cbiAgICpcbiAgICogSWYgdGhlIHBvcnQgaXMgb21pdHRlZCwgYDo4MGAgaXMgdXNlZCBieSBkZWZhdWx0IGZvciBIVFRQIHdoZW4gaW52b2tpbmdcbiAgICogbm9uLVRMUyBtZXRob2RzIHN1Y2ggYXMgYFNlcnZlci5saXN0ZW5BbmRTZXJ2ZWAsIGFuZCBgOjQ0M2AgaXNcbiAgICogdXNlZCBieSBkZWZhdWx0IGZvciBIVFRQUyB3aGVuIGludm9raW5nIFRMUyBtZXRob2RzIHN1Y2ggYXNcbiAgICogYFNlcnZlci5saXN0ZW5BbmRTZXJ2ZVRsc2AuXG4gICAqXG4gICAqIElmIHRoZSBob3N0IGlzIG9taXR0ZWQsIHRoZSBub24tcm91dGFibGUgbWV0YS1hZGRyZXNzIGAwLjAuMC4wYCBpcyB1c2VkLlxuICAgKi9cbiAgYWRkcj86IHN0cmluZztcblxuICAvKiogVGhlIGhhbmRsZXIgdG8gaW52b2tlIGZvciBpbmRpdmlkdWFsIEhUVFAgcmVxdWVzdHMuICovXG4gIGhhbmRsZXI6IEhhbmRsZXI7XG59XG5cbi8qKiBVc2VkIHRvIGNvbnN0cnVjdCBhbiBIVFRQIHNlcnZlci4gKi9cbmV4cG9ydCBjbGFzcyBTZXJ2ZXIge1xuICAjYWRkcj86IHN0cmluZztcbiAgI2hhbmRsZXI6IEhhbmRsZXI7XG4gICNjbG9zZWQgPSBmYWxzZTtcbiAgI2xpc3RlbmVyczogU2V0PERlbm8uTGlzdGVuZXI+ID0gbmV3IFNldCgpO1xuICAjaHR0cENvbm5lY3Rpb25zOiBTZXQ8RGVuby5IdHRwQ29ubj4gPSBuZXcgU2V0KCk7XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBuZXcgSFRUUCBTZXJ2ZXIgaW5zdGFuY2UuXG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IFNlcnZlciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGFkZHIgPSBcIjo0NTA1XCI7XG4gICAqIGNvbnN0IGhhbmRsZXIgPSAocmVxdWVzdDogUmVxdWVzdCkgPT4ge1xuICAgKiAgIGNvbnN0IGJvZHkgPSBgWW91ciB1c2VyLWFnZW50IGlzOlxcblxcbiR7cmVxdWVzdC5oZWFkZXJzLmdldChcbiAgICogICAgXCJ1c2VyLWFnZW50XCIsXG4gICAqICAgKSA/PyBcIlVua25vd25cIn1gO1xuICAgKlxuICAgKiAgIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXM6IDIwMCB9KTtcbiAgICogfTtcbiAgICpcbiAgICogY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcih7IGFkZHIsIGhhbmRsZXIgfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gc2VydmVySW5pdCBPcHRpb25zIGZvciBydW5uaW5nIGFuIEhUVFAgc2VydmVyLlxuICAgKi9cbiAgY29uc3RydWN0b3Ioc2VydmVySW5pdDogU2VydmVySW5pdCkge1xuICAgIHRoaXMuI2FkZHIgPSBzZXJ2ZXJJbml0LmFkZHI7XG4gICAgdGhpcy4jaGFuZGxlciA9IHNlcnZlckluaXQuaGFuZGxlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBBY2NlcHQgaW5jb21pbmcgY29ubmVjdGlvbnMgb24gdGhlIGdpdmVuIGxpc3RlbmVyLCBhbmQgaGFuZGxlIHJlcXVlc3RzIG9uXG4gICAqIHRoZXNlIGNvbm5lY3Rpb25zIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIuXG4gICAqXG4gICAqIEhUVFAvMiBzdXBwb3J0IGlzIG9ubHkgZW5hYmxlZCBpZiB0aGUgcHJvdmlkZWQgRGVuby5MaXN0ZW5lciByZXR1cm5zIFRMU1xuICAgKiBjb25uZWN0aW9ucyBhbmQgd2FzIGNvbmZpZ3VyZWQgd2l0aCBcImgyXCIgaW4gdGhlIEFMUE4gcHJvdG9jb2xzLlxuICAgKlxuICAgKiBUaHJvd3MgYSBzZXJ2ZXIgY2xvc2VkIGVycm9yIGlmIGNhbGxlZCBhZnRlciB0aGUgc2VydmVyIGhhcyBiZWVuIGNsb3NlZC5cbiAgICpcbiAgICogV2lsbCBhbHdheXMgY2xvc2UgdGhlIGNyZWF0ZWQgbGlzdGVuZXIuXG4gICAqXG4gICAqIGBgYHRzXG4gICAqIGltcG9ydCB7IFNlcnZlciB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gICAqXG4gICAqIGNvbnN0IGhhbmRsZXIgPSAocmVxdWVzdDogUmVxdWVzdCkgPT4ge1xuICAgKiAgIGNvbnN0IGJvZHkgPSBgWW91ciB1c2VyLWFnZW50IGlzOlxcblxcbiR7cmVxdWVzdC5oZWFkZXJzLmdldChcbiAgICogICAgXCJ1c2VyLWFnZW50XCIsXG4gICAqICAgKSA/PyBcIlVua25vd25cIn1gO1xuICAgKlxuICAgKiAgIHJldHVybiBuZXcgUmVzcG9uc2UoYm9keSwgeyBzdGF0dXM6IDIwMCB9KTtcbiAgICogfTtcbiAgICpcbiAgICogY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcih7IGhhbmRsZXIgfSk7XG4gICAqIGNvbnN0IGxpc3RlbmVyID0gRGVuby5saXN0ZW4oeyBwb3J0OiA0NTA1IH0pO1xuICAgKlxuICAgKiBjb25zb2xlLmxvZyhcInNlcnZlciBsaXN0ZW5pbmcgb24gaHR0cDovL2xvY2FsaG9zdDo0NTA1XCIpO1xuICAgKlxuICAgKiBhd2FpdCBzZXJ2ZXIuc2VydmUobGlzdGVuZXIpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGxpc3RlbmVyIFRoZSBsaXN0ZW5lciB0byBhY2NlcHQgY29ubmVjdGlvbnMgZnJvbS5cbiAgICovXG4gIGFzeW5jIHNlcnZlKGxpc3RlbmVyOiBEZW5vLkxpc3RlbmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuI2Nsb3NlZCkge1xuICAgICAgdGhyb3cgbmV3IERlbm8uZXJyb3JzLkh0dHAoRVJST1JfU0VSVkVSX0NMT1NFRCk7XG4gICAgfVxuXG4gICAgdGhpcy4jdHJhY2tMaXN0ZW5lcihsaXN0ZW5lcik7XG5cbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuI2FjY2VwdChsaXN0ZW5lcik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMuI3VudHJhY2tMaXN0ZW5lcihsaXN0ZW5lcik7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGxpc3RlbmVyLmNsb3NlKCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLy8gTGlzdGVuZXIgaGFzIGFscmVhZHkgYmVlbiBjbG9zZWQuXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIGxpc3RlbmVyIG9uIHRoZSBzZXJ2ZXIsIGFjY2VwdCBpbmNvbWluZyBjb25uZWN0aW9ucywgYW5kIGhhbmRsZVxuICAgKiByZXF1ZXN0cyBvbiB0aGVzZSBjb25uZWN0aW9ucyB3aXRoIHRoZSBnaXZlbiBoYW5kbGVyLlxuICAgKlxuICAgKiBJZiB0aGUgc2VydmVyIHdhcyBjb25zdHJ1Y3RlZCB3aXRoIHRoZSBwb3J0IG9taXR0ZWQgZnJvbSB0aGUgYWRkcmVzcywgYDo4MGBcbiAgICogaXMgdXNlZC5cbiAgICpcbiAgICogSWYgdGhlIHNlcnZlciB3YXMgY29uc3RydWN0ZWQgd2l0aCB0aGUgaG9zdCBvbWl0dGVkIGZyb20gdGhlIGFkZHJlc3MsIHRoZVxuICAgKiBub24tcm91dGFibGUgbWV0YS1hZGRyZXNzIGAwLjAuMC4wYCBpcyB1c2VkLlxuICAgKlxuICAgKiBUaHJvd3MgYSBzZXJ2ZXIgY2xvc2VkIGVycm9yIGlmIHRoZSBzZXJ2ZXIgaGFzIGJlZW4gY2xvc2VkLlxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBTZXJ2ZXIgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9odHRwL3NlcnZlci50c1wiO1xuICAgKlxuICAgKiBjb25zdCBhZGRyID0gXCI6NDUwNVwiO1xuICAgKiBjb25zdCBoYW5kbGVyID0gKHJlcXVlc3Q6IFJlcXVlc3QpID0+IHtcbiAgICogICBjb25zdCBib2R5ID0gYFlvdXIgdXNlci1hZ2VudCBpczpcXG5cXG4ke3JlcXVlc3QuaGVhZGVycy5nZXQoXG4gICAqICAgIFwidXNlci1hZ2VudFwiLFxuICAgKiAgICkgPz8gXCJVbmtub3duXCJ9YDtcbiAgICpcbiAgICogICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzOiAyMDAgfSk7XG4gICAqIH07XG4gICAqXG4gICAqIGNvbnN0IHNlcnZlciA9IG5ldyBTZXJ2ZXIoeyBhZGRyLCBoYW5kbGVyIH0pO1xuICAgKlxuICAgKiBjb25zb2xlLmxvZyhcInNlcnZlciBsaXN0ZW5pbmcgb24gaHR0cDovL2xvY2FsaG9zdDo0NTA1XCIpO1xuICAgKlxuICAgKiBhd2FpdCBzZXJ2ZXIubGlzdGVuQW5kU2VydmUoKTtcbiAgICogYGBgXG4gICAqL1xuICBhc3luYyBsaXN0ZW5BbmRTZXJ2ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAodGhpcy4jY2xvc2VkKSB7XG4gICAgICB0aHJvdyBuZXcgRGVuby5lcnJvcnMuSHR0cChFUlJPUl9TRVJWRVJfQ0xPU0VEKTtcbiAgICB9XG5cbiAgICBjb25zdCBhZGRyID0gdGhpcy4jYWRkciA/PyBgOiR7SFRUUF9QT1JUfWA7XG4gICAgY29uc3QgbGlzdGVuT3B0aW9ucyA9IF9wYXJzZUFkZHJGcm9tU3RyKGFkZHIsIEhUVFBfUE9SVCk7XG5cbiAgICBjb25zdCBsaXN0ZW5lciA9IERlbm8ubGlzdGVuKHtcbiAgICAgIC4uLmxpc3Rlbk9wdGlvbnMsXG4gICAgICB0cmFuc3BvcnQ6IFwidGNwXCIsXG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXdhaXQgdGhpcy5zZXJ2ZShsaXN0ZW5lcik7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbGlzdGVuZXIgb24gdGhlIHNlcnZlciwgYWNjZXB0IGluY29taW5nIGNvbm5lY3Rpb25zLCB1cGdyYWRlIHRoZW1cbiAgICogdG8gVExTLCBhbmQgaGFuZGxlIHJlcXVlc3RzIG9uIHRoZXNlIGNvbm5lY3Rpb25zIHdpdGggdGhlIGdpdmVuIGhhbmRsZXIuXG4gICAqXG4gICAqIElmIHRoZSBzZXJ2ZXIgd2FzIGNvbnN0cnVjdGVkIHdpdGggdGhlIHBvcnQgb21pdHRlZCBmcm9tIHRoZSBhZGRyZXNzLCBgOjQ0M2BcbiAgICogaXMgdXNlZC5cbiAgICpcbiAgICogSWYgdGhlIHNlcnZlciB3YXMgY29uc3RydWN0ZWQgd2l0aCB0aGUgaG9zdCBvbWl0dGVkIGZyb20gdGhlIGFkZHJlc3MsIHRoZVxuICAgKiBub24tcm91dGFibGUgbWV0YS1hZGRyZXNzIGAwLjAuMC4wYCBpcyB1c2VkLlxuICAgKlxuICAgKiBUaHJvd3MgYSBzZXJ2ZXIgY2xvc2VkIGVycm9yIGlmIHRoZSBzZXJ2ZXIgaGFzIGJlZW4gY2xvc2VkLlxuICAgKlxuICAgKiBgYGB0c1xuICAgKiBpbXBvcnQgeyBTZXJ2ZXIgfSBmcm9tIFwiaHR0cHM6Ly9kZW5vLmxhbmQvc3RkQCRTVERfVkVSU0lPTi9odHRwL3NlcnZlci50c1wiO1xuICAgKlxuICAgKiBjb25zdCBhZGRyID0gXCI6NDUwNVwiO1xuICAgKiBjb25zdCBoYW5kbGVyID0gKHJlcXVlc3Q6IFJlcXVlc3QpID0+IHtcbiAgICogICBjb25zdCBib2R5ID0gYFlvdXIgdXNlci1hZ2VudCBpczpcXG5cXG4ke3JlcXVlc3QuaGVhZGVycy5nZXQoXG4gICAqICAgIFwidXNlci1hZ2VudFwiLFxuICAgKiAgICkgPz8gXCJVbmtub3duXCJ9YDtcbiAgICpcbiAgICogICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzOiAyMDAgfSk7XG4gICAqIH07XG4gICAqXG4gICAqIGNvbnN0IHNlcnZlciA9IG5ldyBTZXJ2ZXIoeyBhZGRyLCBoYW5kbGVyIH0pO1xuICAgKlxuICAgKiBjb25zdCBjZXJ0RmlsZSA9IFwiL3BhdGgvdG8vY2VydEZpbGUuY3J0XCI7XG4gICAqIGNvbnN0IGtleUZpbGUgPSBcIi9wYXRoL3RvL2tleUZpbGUua2V5XCI7XG4gICAqXG4gICAqIGNvbnNvbGUubG9nKFwic2VydmVyIGxpc3RlbmluZyBvbiBodHRwczovL2xvY2FsaG9zdDo0NTA1XCIpO1xuICAgKlxuICAgKiBhd2FpdCBzZXJ2ZXIubGlzdGVuQW5kU2VydmVUbHMoY2VydEZpbGUsIGtleUZpbGUpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNlcnRGaWxlIFRoZSBwYXRoIHRvIHRoZSBmaWxlIGNvbnRhaW5pbmcgdGhlIFRMUyBjZXJ0aWZpY2F0ZS5cbiAgICogQHBhcmFtIGtleUZpbGUgVGhlIHBhdGggdG8gdGhlIGZpbGUgY29udGFpbmluZyB0aGUgVExTIHByaXZhdGUga2V5LlxuICAgKi9cbiAgYXN5bmMgbGlzdGVuQW5kU2VydmVUbHMoY2VydEZpbGU6IHN0cmluZywga2V5RmlsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKHRoaXMuI2Nsb3NlZCkge1xuICAgICAgdGhyb3cgbmV3IERlbm8uZXJyb3JzLkh0dHAoRVJST1JfU0VSVkVSX0NMT1NFRCk7XG4gICAgfVxuXG4gICAgY29uc3QgYWRkciA9IHRoaXMuI2FkZHIgPz8gYDoke0hUVFBTX1BPUlR9YDtcbiAgICBjb25zdCBsaXN0ZW5PcHRpb25zID0gX3BhcnNlQWRkckZyb21TdHIoYWRkciwgSFRUUFNfUE9SVCk7XG5cbiAgICBjb25zdCBsaXN0ZW5lciA9IERlbm8ubGlzdGVuVGxzKHtcbiAgICAgIC4uLmxpc3Rlbk9wdGlvbnMsXG4gICAgICBjZXJ0RmlsZSxcbiAgICAgIGtleUZpbGUsXG4gICAgICB0cmFuc3BvcnQ6IFwidGNwXCIsXG4gICAgICAvLyBBTFBOIHByb3RvY29sIHN1cHBvcnQgbm90IHlldCBzdGFibGUuXG4gICAgICAvLyBhbHBuUHJvdG9jb2xzOiBbXCJoMlwiLCBcImh0dHAvMS4xXCJdLFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIGF3YWl0IHRoaXMuc2VydmUobGlzdGVuZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEltbWVkaWF0ZWx5IGNsb3NlIHRoZSBzZXJ2ZXIgbGlzdGVuZXJzIGFuZCBhc3NvY2lhdGVkIEhUVFAgY29ubmVjdGlvbnMuXG4gICAqXG4gICAqIFRocm93cyBhIHNlcnZlciBjbG9zZWQgZXJyb3IgaWYgY2FsbGVkIGFmdGVyIHRoZSBzZXJ2ZXIgaGFzIGJlZW4gY2xvc2VkLlxuICAgKi9cbiAgY2xvc2UoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuI2Nsb3NlZCkge1xuICAgICAgdGhyb3cgbmV3IERlbm8uZXJyb3JzLkh0dHAoRVJST1JfU0VSVkVSX0NMT1NFRCk7XG4gICAgfVxuXG4gICAgdGhpcy4jY2xvc2VkID0gdHJ1ZTtcblxuICAgIGZvciAoY29uc3QgbGlzdGVuZXIgb2YgdGhpcy4jbGlzdGVuZXJzKSB7XG4gICAgICB0cnkge1xuICAgICAgICBsaXN0ZW5lci5jbG9zZSgpO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIExpc3RlbmVyIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkLlxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuI2xpc3RlbmVycy5jbGVhcigpO1xuXG4gICAgZm9yIChjb25zdCBodHRwQ29ubiBvZiB0aGlzLiNodHRwQ29ubmVjdGlvbnMpIHtcbiAgICAgIHRoaXMuI2Nsb3NlSHR0cENvbm4oaHR0cENvbm4pO1xuICAgIH1cblxuICAgIHRoaXMuI2h0dHBDb25uZWN0aW9ucy5jbGVhcigpO1xuICB9XG5cbiAgLyoqIEdldCB3aGV0aGVyIHRoZSBzZXJ2ZXIgaXMgY2xvc2VkLiAqL1xuICBnZXQgY2xvc2VkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLiNjbG9zZWQ7XG4gIH1cblxuICAvKiogR2V0IHRoZSBsaXN0IG9mIG5ldHdvcmsgYWRkcmVzc2VzIHRoZSBzZXJ2ZXIgaXMgbGlzdGVuaW5nIG9uLiAqL1xuICBnZXQgYWRkcnMoKTogRGVuby5BZGRyW10ge1xuICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMuI2xpc3RlbmVycykubWFwKChsaXN0ZW5lcikgPT4gbGlzdGVuZXIuYWRkcik7XG4gIH1cblxuICAvKipcbiAgICogUmVzcG9uZHMgdG8gYW4gSFRUUCByZXF1ZXN0LlxuICAgKlxuICAgKiBAcGFyYW0gcmVxdWVzdEV2ZW50IFRoZSBIVFRQIHJlcXVlc3QgdG8gcmVzcG9uZCB0by5cbiAgICogQHBhcmFtIGh0dHBDb24gVGhlIEhUVFAgY29ubmVjdGlvbiB0byB5aWVsZCByZXF1ZXN0cyBmcm9tLlxuICAgKiBAcGFyYW0gY29ubkluZm8gSW5mb3JtYXRpb24gYWJvdXQgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbi5cbiAgICovXG4gIGFzeW5jICNyZXNwb25kKFxuICAgIHJlcXVlc3RFdmVudDogRGVuby5SZXF1ZXN0RXZlbnQsXG4gICAgaHR0cENvbm46IERlbm8uSHR0cENvbm4sXG4gICAgY29ubkluZm86IENvbm5JbmZvLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0cnkge1xuICAgICAgLy8gSGFuZGxlIHRoZSByZXF1ZXN0IGV2ZW50LCBnZW5lcmF0aW5nIGEgcmVzcG9uc2UuXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuI2hhbmRsZXIoXG4gICAgICAgIHJlcXVlc3RFdmVudC5yZXF1ZXN0LFxuICAgICAgICBjb25uSW5mbyxcbiAgICAgICk7XG5cbiAgICAgIC8vIFNlbmQgdGhlIHJlc3BvbnNlLlxuICAgICAgYXdhaXQgcmVxdWVzdEV2ZW50LnJlc3BvbmRXaXRoKHJlc3BvbnNlKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIElmIHRoZSBoYW5kbGVyIHRocm93cyB0aGVuIGl0IGlzIGFzc3VtZWQgdGhhdCB0aGUgaW1wYWN0IG9mIHRoZSBlcnJvclxuICAgICAgLy8gaXMgaXNvbGF0ZWQgdG8gdGhlIGluZGl2aWR1YWwgcmVxdWVzdCwgc28gd2UgY2xvc2UgdGhlIGNvbm5lY3Rpb24uXG4gICAgICAvL1xuICAgICAgLy8gQWx0ZXJuYXRpdmVseSB0aGUgY29ubmVjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIGNsb3NlZCwgb3IgdGhlcmUgaXMgc29tZVxuICAgICAgLy8gb3RoZXIgZXJyb3Igd2l0aCByZXNwb25kaW5nIG9uIHRoaXMgY29ubmVjdGlvbiB0aGF0IHByb21wdHMgdXMgdG9cbiAgICAgIC8vIGNsb3NlIGl0IGFuZCBvcGVuIGEgbmV3IGNvbm5lY3Rpb24uXG4gICAgICByZXR1cm4gdGhpcy4jY2xvc2VIdHRwQ29ubihodHRwQ29ubik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNlcnZlcyBhbGwgSFRUUCByZXF1ZXN0cyBvbiBhIHNpbmdsZSBjb25uZWN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gaHR0cENvbm4gVGhlIEhUVFAgY29ubmVjdGlvbiB0byB5aWVsZCByZXF1ZXN0cyBmcm9tLlxuICAgKiBAcGFyYW0gY29ubkluZm8gSW5mb3JtYXRpb24gYWJvdXQgdGhlIHVuZGVybHlpbmcgY29ubmVjdGlvbi5cbiAgICovXG4gIGFzeW5jICNzZXJ2ZUh0dHAoXG4gICAgaHR0cENvbm46IERlbm8uSHR0cENvbm4sXG4gICAgY29ubkluZm86IENvbm5JbmZvLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB3aGlsZSAoIXRoaXMuI2Nsb3NlZCkge1xuICAgICAgbGV0IHJlcXVlc3RFdmVudDogRGVuby5SZXF1ZXN0RXZlbnQgfCBudWxsO1xuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBZaWVsZCB0aGUgbmV3IEhUVFAgcmVxdWVzdCBvbiB0aGUgY29ubmVjdGlvbi5cbiAgICAgICAgcmVxdWVzdEV2ZW50ID0gYXdhaXQgaHR0cENvbm4ubmV4dFJlcXVlc3QoKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvLyBDb25uZWN0aW9uIGhhcyBiZWVuIGNsb3NlZC5cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1ZXN0RXZlbnQgPT09IG51bGwpIHtcbiAgICAgICAgLy8gQ29ubmVjdGlvbiBoYXMgYmVlbiBjbG9zZWQuXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBSZXNwb25kIHRvIHRoZSByZXF1ZXN0LiBOb3RlIHdlIGRvIG5vdCBhd2FpdCB0aGlzIGFzeW5jIG1ldGhvZCB0b1xuICAgICAgLy8gYWxsb3cgdGhlIGNvbm5lY3Rpb24gdG8gaGFuZGxlIG11bHRpcGxlIHJlcXVlc3RzIGluIHRoZSBjYXNlIG9mIGgyLlxuICAgICAgdGhpcy4jcmVzcG9uZChyZXF1ZXN0RXZlbnQsIGh0dHBDb25uLCBjb25uSW5mbyk7XG4gICAgfVxuXG4gICAgdGhpcy4jY2xvc2VIdHRwQ29ubihodHRwQ29ubik7XG4gIH1cblxuICAvKipcbiAgICogQWNjZXB0cyBhbGwgY29ubmVjdGlvbnMgb24gYSBzaW5nbGUgbmV0d29yayBsaXN0ZW5lci5cbiAgICpcbiAgICogQHBhcmFtIGxpc3RlbmVyIFRoZSBsaXN0ZW5lciB0byBhY2NlcHQgY29ubmVjdGlvbnMgZnJvbS5cbiAgICovXG4gIGFzeW5jICNhY2NlcHQoXG4gICAgbGlzdGVuZXI6IERlbm8uTGlzdGVuZXIsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxldCBhY2NlcHRCYWNrb2ZmRGVsYXk6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuICAgIHdoaWxlICghdGhpcy4jY2xvc2VkKSB7XG4gICAgICBsZXQgY29ubjogRGVuby5Db25uO1xuXG4gICAgICB0cnkge1xuICAgICAgICAvLyBXYWl0IGZvciBhIG5ldyBjb25uZWN0aW9uLlxuICAgICAgICBjb25uID0gYXdhaXQgbGlzdGVuZXIuYWNjZXB0KCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgLy8gVGhlIGxpc3RlbmVyIGlzIGNsb3NlZC5cbiAgICAgICAgICBlcnJvciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlIHx8XG4gICAgICAgICAgLy8gVExTIGhhbmRzaGFrZSBlcnJvcnMuXG4gICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5JbnZhbGlkRGF0YSB8fFxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuVW5leHBlY3RlZEVvZiB8fFxuICAgICAgICAgIGVycm9yIGluc3RhbmNlb2YgRGVuby5lcnJvcnMuQ29ubmVjdGlvblJlc2V0IHx8XG4gICAgICAgICAgZXJyb3IgaW5zdGFuY2VvZiBEZW5vLmVycm9ycy5Ob3RDb25uZWN0ZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgLy8gQmFja29mZiBhZnRlciB0cmFuc2llbnQgZXJyb3JzIHRvIGFsbG93IHRpbWUgZm9yIHRoZSBzeXN0ZW0gdG9cbiAgICAgICAgICAvLyByZWNvdmVyLCBhbmQgYXZvaWQgYmxvY2tpbmcgdXAgdGhlIGV2ZW50IGxvb3Agd2l0aCBhIGNvbnRpbnVvdXNseVxuICAgICAgICAgIC8vIHJ1bm5pbmcgbG9vcC5cbiAgICAgICAgICBpZiAoIWFjY2VwdEJhY2tvZmZEZWxheSkge1xuICAgICAgICAgICAgYWNjZXB0QmFja29mZkRlbGF5ID0gSU5JVElBTF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWNjZXB0QmFja29mZkRlbGF5ICo9IDI7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGFjY2VwdEJhY2tvZmZEZWxheSA+PSBNQVhfQUNDRVBUX0JBQ0tPRkZfREVMQVkpIHtcbiAgICAgICAgICAgIGFjY2VwdEJhY2tvZmZEZWxheSA9IE1BWF9BQ0NFUFRfQkFDS09GRl9ERUxBWTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBkZWxheShhY2NlcHRCYWNrb2ZmRGVsYXkpO1xuXG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgIH1cblxuICAgICAgYWNjZXB0QmFja29mZkRlbGF5ID0gdW5kZWZpbmVkO1xuXG4gICAgICAvLyBcIlVwZ3JhZGVcIiB0aGUgbmV0d29yayBjb25uZWN0aW9uIGludG8gYW4gSFRUUCBjb25uZWN0aW9uLlxuICAgICAgbGV0IGh0dHBDb25uOiBEZW5vLkh0dHBDb25uO1xuXG4gICAgICB0cnkge1xuICAgICAgICBodHRwQ29ubiA9IERlbm8uc2VydmVIdHRwKGNvbm4pO1xuICAgICAgfSBjYXRjaCB7XG4gICAgICAgIC8vIENvbm5lY3Rpb24gaGFzIGJlZW4gY2xvc2VkLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gQ2xvc2luZyB0aGUgdW5kZXJseWluZyBsaXN0ZW5lciB3aWxsIG5vdCBjbG9zZSBIVFRQIGNvbm5lY3Rpb25zLCBzbyB3ZVxuICAgICAgLy8gdHJhY2sgZm9yIGNsb3N1cmUgdXBvbiBzZXJ2ZXIgY2xvc2UuXG4gICAgICB0aGlzLiN0cmFja0h0dHBDb25uZWN0aW9uKGh0dHBDb25uKTtcblxuICAgICAgY29uc3QgY29ubkluZm86IENvbm5JbmZvID0ge1xuICAgICAgICBsb2NhbEFkZHI6IGNvbm4ubG9jYWxBZGRyLFxuICAgICAgICByZW1vdGVBZGRyOiBjb25uLnJlbW90ZUFkZHIsXG4gICAgICB9O1xuXG4gICAgICAvLyBTZXJ2ZSB0aGUgcmVxdWVzdHMgdGhhdCBhcnJpdmUgb24gdGhlIGp1c3QtYWNjZXB0ZWQgY29ubmVjdGlvbi4gTm90ZVxuICAgICAgLy8gd2UgZG8gbm90IGF3YWl0IHRoaXMgYXN5bmMgbWV0aG9kIHRvIGFsbG93IHRoZSBzZXJ2ZXIgdG8gYWNjZXB0IG5ld1xuICAgICAgLy8gY29ubmVjdGlvbnMuXG4gICAgICB0aGlzLiNzZXJ2ZUh0dHAoaHR0cENvbm4sIGNvbm5JbmZvKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVW50cmFja3MgYW5kIGNsb3NlcyBhbiBIVFRQIGNvbm5lY3Rpb24uXG4gICAqXG4gICAqIEBwYXJhbSBodHRwQ29ubiBUaGUgSFRUUCBjb25uZWN0aW9uIHRvIGNsb3NlLlxuICAgKi9cbiAgI2Nsb3NlSHR0cENvbm4oaHR0cENvbm46IERlbm8uSHR0cENvbm4pOiB2b2lkIHtcbiAgICB0aGlzLiN1bnRyYWNrSHR0cENvbm5lY3Rpb24oaHR0cENvbm4pO1xuXG4gICAgdHJ5IHtcbiAgICAgIGh0dHBDb25uLmNsb3NlKCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvLyBDb25uZWN0aW9uIGhhcyBhbHJlYWR5IGJlZW4gY2xvc2VkLlxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIHRoZSBsaXN0ZW5lciB0byB0aGUgaW50ZXJuYWwgdHJhY2tpbmcgbGlzdC5cbiAgICpcbiAgICogQHBhcmFtIGxpc3RlbmVyIExpc3RlbmVyIHRvIHRyYWNrLlxuICAgKi9cbiAgI3RyYWNrTGlzdGVuZXIobGlzdGVuZXI6IERlbm8uTGlzdGVuZXIpOiB2b2lkIHtcbiAgICB0aGlzLiNsaXN0ZW5lcnMuYWRkKGxpc3RlbmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIHRoZSBsaXN0ZW5lciBmcm9tIHRoZSBpbnRlcm5hbCB0cmFja2luZyBsaXN0LlxuICAgKlxuICAgKiBAcGFyYW0gbGlzdGVuZXIgTGlzdGVuZXIgdG8gdW50cmFjay5cbiAgICovXG4gICN1bnRyYWNrTGlzdGVuZXIobGlzdGVuZXI6IERlbm8uTGlzdGVuZXIpOiB2b2lkIHtcbiAgICB0aGlzLiNsaXN0ZW5lcnMuZGVsZXRlKGxpc3RlbmVyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIHRoZSBIVFRQIGNvbm5lY3Rpb24gdG8gdGhlIGludGVybmFsIHRyYWNraW5nIGxpc3QuXG4gICAqXG4gICAqIEBwYXJhbSBodHRwQ29ubiBIVFRQIGNvbm5lY3Rpb24gdG8gdHJhY2suXG4gICAqL1xuICAjdHJhY2tIdHRwQ29ubmVjdGlvbihodHRwQ29ubjogRGVuby5IdHRwQ29ubik6IHZvaWQge1xuICAgIHRoaXMuI2h0dHBDb25uZWN0aW9ucy5hZGQoaHR0cENvbm4pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgdGhlIEhUVFAgY29ubmVjdGlvbiBmcm9tIHRoZSBpbnRlcm5hbCB0cmFja2luZyBsaXN0LlxuICAgKlxuICAgKiBAcGFyYW0gaHR0cENvbm4gSFRUUCBjb25uZWN0aW9uIHRvIHVudHJhY2suXG4gICAqL1xuICAjdW50cmFja0h0dHBDb25uZWN0aW9uKGh0dHBDb25uOiBEZW5vLkh0dHBDb25uKTogdm9pZCB7XG4gICAgdGhpcy4jaHR0cENvbm5lY3Rpb25zLmRlbGV0ZShodHRwQ29ubik7XG4gIH1cbn1cblxuLyoqIEFkZGl0aW9uYWwgc2VydmUgb3B0aW9ucy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU2VydmVJbml0IHtcbiAgLyoqXG4gICAqIE9wdGlvbmFsbHkgc3BlY2lmaWVzIHRoZSBhZGRyZXNzIHRvIGxpc3RlbiBvbiwgaW4gdGhlIGZvcm1cbiAgICogXCJob3N0OnBvcnRcIi5cbiAgICovXG4gIGFkZHI/OiBzdHJpbmc7XG5cbiAgLyoqIEFuIEFib3J0U2lnbmFsIHRvIGNsb3NlIHRoZSBzZXJ2ZXIgYW5kIGFsbCBjb25uZWN0aW9ucy4gKi9cbiAgc2lnbmFsPzogQWJvcnRTaWduYWw7XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIHNlcnZlciwgYWNjZXB0cyBpbmNvbWluZyBjb25uZWN0aW9ucyBvbiB0aGUgZ2l2ZW4gbGlzdGVuZXIsIGFuZFxuICogaGFuZGxlcyByZXF1ZXN0cyBvbiB0aGVzZSBjb25uZWN0aW9ucyB3aXRoIHRoZSBnaXZlbiBoYW5kbGVyLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBzZXJ2ZUxpc3RlbmVyIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9zZXJ2ZXIudHNcIjtcbiAqXG4gKiBjb25zdCBsaXN0ZW5lciA9IERlbm8ubGlzdGVuKHsgcG9ydDogNDUwNSB9KTtcbiAqXG4gKiBjb25zb2xlLmxvZyhcInNlcnZlciBsaXN0ZW5pbmcgb24gaHR0cDovL2xvY2FsaG9zdDo0NTA1XCIpO1xuICpcbiAqIGF3YWl0IHNlcnZlTGlzdGVuZXIobGlzdGVuZXIsIChyZXF1ZXN0KSA9PiB7XG4gKiAgIGNvbnN0IGJvZHkgPSBgWW91ciB1c2VyLWFnZW50IGlzOlxcblxcbiR7cmVxdWVzdC5oZWFkZXJzLmdldChcbiAqICAgICBcInVzZXItYWdlbnRcIixcbiAqICAgKSA/PyBcIlVua25vd25cIn1gO1xuICpcbiAqICAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1czogMjAwIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gbGlzdGVuZXIgVGhlIGxpc3RlbmVyIHRvIGFjY2VwdCBjb25uZWN0aW9ucyBmcm9tLlxuICogQHBhcmFtIGhhbmRsZXIgVGhlIGhhbmRsZXIgZm9yIGluZGl2aWR1YWwgSFRUUCByZXF1ZXN0cy5cbiAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbmFsIHNlcnZlIG9wdGlvbnMuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXJ2ZUxpc3RlbmVyKFxuICBsaXN0ZW5lcjogRGVuby5MaXN0ZW5lcixcbiAgaGFuZGxlcjogSGFuZGxlcixcbiAgb3B0aW9ucz86IE9taXQ8U2VydmVJbml0LCBcImFkZHJcIj4sXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcih7IGhhbmRsZXIgfSk7XG5cbiAgaWYgKG9wdGlvbnM/LnNpZ25hbCkge1xuICAgIG9wdGlvbnMuc2lnbmFsLm9uYWJvcnQgPSAoKSA9PiBzZXJ2ZXIuY2xvc2UoKTtcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBzZXJ2ZXIuc2VydmUobGlzdGVuZXIpO1xufVxuXG4vKiogU2VydmVzIEhUVFAgcmVxdWVzdHMgd2l0aCB0aGUgZ2l2ZW4gaGFuZGxlci5cbiAqXG4gKiBZb3UgY2FuIHNwZWNpZmllcyBgYWRkcmAgb3B0aW9uLCB3aGljaCBpcyB0aGUgYWRkcmVzcyB0byBsaXN0ZW4gb24sXG4gKiBpbiB0aGUgZm9ybSBcImhvc3Q6cG9ydFwiLiBUaGUgZGVmYXVsdCBpcyBcIjAuMC4wLjA6ODAwMFwiLlxuICpcbiAqIFRoZSBiZWxvdyBleGFtcGxlIHNlcnZlcyB3aXRoIHRoZSBwb3J0IDgwMDAuXG4gKlxuICogYGBgdHNcbiAqIGltcG9ydCB7IHNlcnZlIH0gZnJvbSBcImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAkU1REX1ZFUlNJT04vaHR0cC9zZXJ2ZXIudHNcIjtcbiAqIHNlcnZlKChfcmVxKSA9PiBuZXcgUmVzcG9uc2UoXCJIZWxsbywgd29ybGRcIikpO1xuICogYGBgXG4gKlxuICogWW91IGNhbiBjaGFuZ2UgdGhlIGxpc3RlbmluZyBhZGRyZXNzIGJ5IGBhZGRyYCBvcHRpb24uIFRoZSBiZWxvdyBleGFtcGxlXG4gKiBzZXJ2ZXMgd2l0aCB0aGUgcG9ydCAzMDAwLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBzZXJ2ZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gKiBjb25zb2xlLmxvZyhcInNlcnZlciBpcyBzdGFydGluZyBhdCBsb2NhbGhvc3Q6MzAwMFwiKTtcbiAqIHNlcnZlKChfcmVxKSA9PiBuZXcgUmVzcG9uc2UoXCJIZWxsbywgd29ybGRcIiksIHsgYWRkcjogXCI6MzAwMFwiIH0pO1xuICogYGBgXG4gKlxuICogQHBhcmFtIGhhbmRsZXIgVGhlIGhhbmRsZXIgZm9yIGluZGl2aWR1YWwgSFRUUCByZXF1ZXN0cy5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zLiBTZWUgYFNlcnZlSW5pdGAgZG9jdW1lbnRhdGlvbiBmb3IgZGV0YWlscy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlcnZlKFxuICBoYW5kbGVyOiBIYW5kbGVyLFxuICBvcHRpb25zOiBTZXJ2ZUluaXQgPSB7fSxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBhZGRyID0gb3B0aW9ucy5hZGRyID8/IFwiOjgwMDBcIjtcbiAgY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcih7IGFkZHIsIGhhbmRsZXIgfSk7XG5cbiAgaWYgKG9wdGlvbnM/LnNpZ25hbCkge1xuICAgIG9wdGlvbnMuc2lnbmFsLm9uYWJvcnQgPSAoKSA9PiBzZXJ2ZXIuY2xvc2UoKTtcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBzZXJ2ZXIubGlzdGVuQW5kU2VydmUoKTtcbn1cblxuaW50ZXJmYWNlIFNlcnZlVGxzSW5pdCBleHRlbmRzIFNlcnZlSW5pdCB7XG4gIC8qKiBUaGUgcGF0aCB0byB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBUTFMgcHJpdmF0ZSBrZXkuICovXG4gIGtleUZpbGU6IHN0cmluZztcblxuICAvKiogVGhlIHBhdGggdG8gdGhlIGZpbGUgY29udGFpbmluZyB0aGUgVExTIGNlcnRpZmljYXRlICovXG4gIGNlcnRGaWxlOiBzdHJpbmc7XG59XG5cbi8qKiBTZXJ2ZXMgSFRUUFMgcmVxdWVzdHMgd2l0aCB0aGUgZ2l2ZW4gaGFuZGxlci5cbiAqXG4gKiBZb3UgbXVzdCBzcGVjaWZ5IGBrZXlGaWxlYCBhbmQgYGNlcnRGaWxlYCBvcHRpb25zLlxuICpcbiAqIFlvdSBjYW4gc3BlY2lmaWVzIGBhZGRyYCBvcHRpb24sIHdoaWNoIGlzIHRoZSBhZGRyZXNzIHRvIGxpc3RlbiBvbixcbiAqIGluIHRoZSBmb3JtIFwiaG9zdDpwb3J0XCIuIFRoZSBkZWZhdWx0IGlzIFwiMC4wLjAuMDo4NDQzXCIuXG4gKlxuICogVGhlIGJlbG93IGV4YW1wbGUgc2VydmVzIHdpdGggdGhlIGRlZmF1bHQgcG9ydCA4NDQzLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBzZXJ2ZVRscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gKiBjb25zdCBjZXJ0RmlsZSA9IFwiL3BhdGgvdG8vY2VydEZpbGUuY3J0XCI7XG4gKiBjb25zdCBrZXlGaWxlID0gXCIvcGF0aC90by9rZXlGaWxlLmtleVwiO1xuICogY29uc29sZS5sb2coXCJzZXJ2ZXIgaXMgc3RhcnRpbmcgYXQgaHR0cHM6Ly9sb2NhbGhvc3Q6ODQ0M1wiKTtcbiAqIHNlcnZlVGxzKChfcmVxKSA9PiBuZXcgUmVzcG9uc2UoXCJIZWxsbywgd29ybGRcIiksIHsgY2VydEZpbGUsIGtleUZpbGUgfSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gaGFuZGxlciBUaGUgaGFuZGxlciBmb3IgaW5kaXZpZHVhbCBIVFRQUyByZXF1ZXN0cy5cbiAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zLiBTZWUgYFNlcnZlVGxzSW5pdGAgZG9jdW1lbnRhdGlvbiBmb3IgZGV0YWlscy5cbiAqIEByZXR1cm5zXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZXJ2ZVRscyhcbiAgaGFuZGxlcjogSGFuZGxlcixcbiAgb3B0aW9uczogU2VydmVUbHNJbml0LFxuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGlmICghb3B0aW9ucy5rZXlGaWxlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVExTIGNvbmZpZyBpcyBnaXZlbiwgYnV0ICdrZXlGaWxlJyBpcyBtaXNzaW5nLlwiKTtcbiAgfVxuXG4gIGlmICghb3B0aW9ucy5jZXJ0RmlsZSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRMUyBjb25maWcgaXMgZ2l2ZW4sIGJ1dCAnY2VydEZpbGUnIGlzIG1pc3NpbmcuXCIpO1xuICB9XG5cbiAgY29uc3QgYWRkciA9IG9wdGlvbnMuYWRkciA/PyBcIjo4NDQzXCI7XG4gIGNvbnN0IHNlcnZlciA9IG5ldyBTZXJ2ZXIoeyBhZGRyLCBoYW5kbGVyIH0pO1xuXG4gIGlmIChvcHRpb25zPy5zaWduYWwpIHtcbiAgICBvcHRpb25zLnNpZ25hbC5vbmFib3J0ID0gKCkgPT4gc2VydmVyLmNsb3NlKCk7XG4gIH1cblxuICByZXR1cm4gYXdhaXQgc2VydmVyLmxpc3RlbkFuZFNlcnZlVGxzKFxuICAgIG9wdGlvbnMuY2VydEZpbGUsXG4gICAgb3B0aW9ucy5rZXlGaWxlLFxuICApO1xufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkIFVzZSBgc2VydmVgIGluc3RlYWQuXG4gKlxuICogQ29uc3RydWN0cyBhIHNlcnZlciwgY3JlYXRlcyBhIGxpc3RlbmVyIG9uIHRoZSBnaXZlbiBhZGRyZXNzLCBhY2NlcHRzXG4gKiBpbmNvbWluZyBjb25uZWN0aW9ucywgYW5kIGhhbmRsZXMgcmVxdWVzdHMgb24gdGhlc2UgY29ubmVjdGlvbnMgd2l0aCB0aGVcbiAqIGdpdmVuIGhhbmRsZXIuXG4gKlxuICogSWYgdGhlIHBvcnQgaXMgb21pdHRlZCBmcm9tIHRoZSBhZGRyZXNzLCBgOjgwYCBpcyB1c2VkLlxuICpcbiAqIElmIHRoZSBob3N0IGlzIG9taXR0ZWQgZnJvbSB0aGUgYWRkcmVzcywgdGhlIG5vbi1yb3V0YWJsZSBtZXRhLWFkZHJlc3NcbiAqIGAwLjAuMC4wYCBpcyB1c2VkLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBsaXN0ZW5BbmRTZXJ2ZSB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gKlxuICogY29uc3QgYWRkciA9IFwiOjQ1MDVcIjtcbiAqXG4gKiBjb25zb2xlLmxvZyhcInNlcnZlciBsaXN0ZW5pbmcgb24gaHR0cDovL2xvY2FsaG9zdDo0NTA1XCIpO1xuICpcbiAqIGF3YWl0IGxpc3RlbkFuZFNlcnZlKGFkZHIsIChyZXF1ZXN0KSA9PiB7XG4gKiAgIGNvbnN0IGJvZHkgPSBgWW91ciB1c2VyLWFnZW50IGlzOlxcblxcbiR7cmVxdWVzdC5oZWFkZXJzLmdldChcbiAqICAgICBcInVzZXItYWdlbnRcIixcbiAqICAgKSA/PyBcIlVua25vd25cIn1gO1xuICpcbiAqICAgcmV0dXJuIG5ldyBSZXNwb25zZShib2R5LCB7IHN0YXR1czogMjAwIH0pO1xuICogfSk7XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gYWRkciBUaGUgYWRkcmVzcyB0byBsaXN0ZW4gb24uXG4gKiBAcGFyYW0gaGFuZGxlciBUaGUgaGFuZGxlciBmb3IgaW5kaXZpZHVhbCBIVFRQIHJlcXVlc3RzLlxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9uYWwgc2VydmUgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpc3RlbkFuZFNlcnZlKFxuICBhZGRyOiBzdHJpbmcsXG4gIGhhbmRsZXI6IEhhbmRsZXIsXG4gIG9wdGlvbnM/OiBTZXJ2ZUluaXQsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3Qgc2VydmVyID0gbmV3IFNlcnZlcih7IGFkZHIsIGhhbmRsZXIgfSk7XG5cbiAgaWYgKG9wdGlvbnM/LnNpZ25hbCkge1xuICAgIG9wdGlvbnMuc2lnbmFsLm9uYWJvcnQgPSAoKSA9PiBzZXJ2ZXIuY2xvc2UoKTtcbiAgfVxuXG4gIHJldHVybiBhd2FpdCBzZXJ2ZXIubGlzdGVuQW5kU2VydmUoKTtcbn1cblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBVc2UgYHNlcnZlVGxzYCBpbnN0ZWFkLlxuICpcbiAqIENvbnN0cnVjdHMgYSBzZXJ2ZXIsIGNyZWF0ZXMgYSBsaXN0ZW5lciBvbiB0aGUgZ2l2ZW4gYWRkcmVzcywgYWNjZXB0c1xuICogaW5jb21pbmcgY29ubmVjdGlvbnMsIHVwZ3JhZGVzIHRoZW0gdG8gVExTLCBhbmQgaGFuZGxlcyByZXF1ZXN0cyBvbiB0aGVzZVxuICogY29ubmVjdGlvbnMgd2l0aCB0aGUgZ2l2ZW4gaGFuZGxlci5cbiAqXG4gKiBJZiB0aGUgcG9ydCBpcyBvbWl0dGVkIGZyb20gdGhlIGFkZHJlc3MsIGA6NDQzYCBpcyB1c2VkLlxuICpcbiAqIElmIHRoZSBob3N0IGlzIG9taXR0ZWQgZnJvbSB0aGUgYWRkcmVzcywgdGhlIG5vbi1yb3V0YWJsZSBtZXRhLWFkZHJlc3NcbiAqIGAwLjAuMC4wYCBpcyB1c2VkLlxuICpcbiAqIGBgYHRzXG4gKiBpbXBvcnQgeyBsaXN0ZW5BbmRTZXJ2ZVRscyB9IGZyb20gXCJodHRwczovL2Rlbm8ubGFuZC9zdGRAJFNURF9WRVJTSU9OL2h0dHAvc2VydmVyLnRzXCI7XG4gKlxuICogY29uc3QgYWRkciA9IFwiOjQ1MDVcIjtcbiAqIGNvbnN0IGNlcnRGaWxlID0gXCIvcGF0aC90by9jZXJ0RmlsZS5jcnRcIjtcbiAqIGNvbnN0IGtleUZpbGUgPSBcIi9wYXRoL3RvL2tleUZpbGUua2V5XCI7XG4gKlxuICogY29uc29sZS5sb2coXCJzZXJ2ZXIgbGlzdGVuaW5nIG9uIGh0dHA6Ly9sb2NhbGhvc3Q6NDUwNVwiKTtcbiAqXG4gKiBhd2FpdCBsaXN0ZW5BbmRTZXJ2ZVRscyhhZGRyLCBjZXJ0RmlsZSwga2V5RmlsZSwgKHJlcXVlc3QpID0+IHtcbiAqICAgY29uc3QgYm9keSA9IGBZb3VyIHVzZXItYWdlbnQgaXM6XFxuXFxuJHtyZXF1ZXN0LmhlYWRlcnMuZ2V0KFxuICogICAgIFwidXNlci1hZ2VudFwiLFxuICogICApID8/IFwiVW5rbm93blwifWA7XG4gKlxuICogICByZXR1cm4gbmV3IFJlc3BvbnNlKGJvZHksIHsgc3RhdHVzOiAyMDAgfSk7XG4gKiB9KTtcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBhZGRyIFRoZSBhZGRyZXNzIHRvIGxpc3RlbiBvbi5cbiAqIEBwYXJhbSBjZXJ0RmlsZSBUaGUgcGF0aCB0byB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBUTFMgY2VydGlmaWNhdGUuXG4gKiBAcGFyYW0ga2V5RmlsZSBUaGUgcGF0aCB0byB0aGUgZmlsZSBjb250YWluaW5nIHRoZSBUTFMgcHJpdmF0ZSBrZXkuXG4gKiBAcGFyYW0gaGFuZGxlciBUaGUgaGFuZGxlciBmb3IgaW5kaXZpZHVhbCBIVFRQIHJlcXVlc3RzLlxuICogQHBhcmFtIG9wdGlvbnMgT3B0aW9uYWwgc2VydmUgb3B0aW9ucy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxpc3RlbkFuZFNlcnZlVGxzKFxuICBhZGRyOiBzdHJpbmcsXG4gIGNlcnRGaWxlOiBzdHJpbmcsXG4gIGtleUZpbGU6IHN0cmluZyxcbiAgaGFuZGxlcjogSGFuZGxlcixcbiAgb3B0aW9ucz86IFNlcnZlSW5pdCxcbik6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBzZXJ2ZXIgPSBuZXcgU2VydmVyKHsgYWRkciwgaGFuZGxlciB9KTtcblxuICBpZiAob3B0aW9ucz8uc2lnbmFsKSB7XG4gICAgb3B0aW9ucy5zaWduYWwub25hYm9ydCA9ICgpID0+IHNlcnZlci5jbG9zZSgpO1xuICB9XG5cbiAgcmV0dXJuIGF3YWl0IHNlcnZlci5saXN0ZW5BbmRTZXJ2ZVRs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