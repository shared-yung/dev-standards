import { test as base, expect } from '@playwright/test';

// E2E の spec はこのファイルの test を使う（@playwright/test の test は eslint.config.js で禁止）。
// baseURL の外へのリクエストを止め、止めたものがあればテストを落とす（TEST-06、docs/tooling/testing.md）。
// アプリが通信の失敗を握りつぶしても気づけるよう、止めるだけで終わらせず最後に確かめる。
// 止められるのはブラウザの HTTP と WebSocket だけ。WebRTC の STUN/TURN（UDP）と、
// webServer などの Node 側の通信は対象外で、接続先を設定で外す
export const test = base.extend<{ blockExternalRequests: undefined }>({
  blockExternalRequests: [
    async ({ context, baseURL }, use) => {
      if (baseURL == undefined) throw new Error('playwright.config.ts の use.baseURL がありません');
      const { host } = new URL(baseURL);
      const isExternal = (url: URL) => url.host !== host;
      const blocked: string[] = [];
      await context.route(isExternal, async (route) => {
        blocked.push(route.request().url());
        await route.abort('blockedbyclient');
      });
      await context.routeWebSocket(isExternal, async (ws) => {
        blocked.push(ws.url());
        await ws.close();
      });
      await use(undefined);
      expect(blocked, 'baseURL の外へのリクエスト（TEST-06）').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
