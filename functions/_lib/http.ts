/** 最小化的 Cloudflare Pages Functions 类型（避免为类型引入额外依赖） */
export interface D1Stmt {
    bind(...v: unknown[]): D1Stmt;
    run(): Promise<unknown>;
}
export interface D1Like {
    prepare(sql: string): D1Stmt;
    batch(stmts: D1Stmt[]): Promise<unknown>;
}
export interface Env {
    DB?: D1Like;
}
export interface Ctx {
    request: Request;
    env: Env;
}

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** 读取 JSON 请求体，限制大小；失败返回 null */
export async function readJson(req: Request, maxBytes: number): Promise<unknown | null> {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > maxBytes) return null;
    const text = await req.text();
    if (text.length > maxBytes) return null;
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}
