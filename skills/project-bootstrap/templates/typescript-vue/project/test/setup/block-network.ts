import net from 'node:net';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';

// 模擬していない通信でテストを落とす（TEST-06、docs/tooling/testing.md）。vitest.config.ts の setupFiles。
// fetch（Node と happy-dom）・XMLHttpRequest・node:http はどれも最後に net.Socket の connect を通るので、
// そこで止める。MSW で模擬したリクエストはここまで来ないので、MSW とはそのまま併用できる。
// テストが立てたサーバー（ループバック）とパイプは通す。UDP（dgram）は見ない
const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);
const originalConnect = net.Socket.prototype.connect;
const blocked: string[] = [];

/** connect の引数から接続先のホストを取り出す。パイプ（path）なら undefined。 */
function hostOf(args: unknown[]): string | undefined {
  // net.connect() は引数を正規化した配列を1つ目に渡してくる
  const [first, second] = Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
  if (typeof first === 'object' && first != undefined) {
    const options = first as { host?: string | undefined; path?: string | undefined };
    return options.path == undefined ? (options.host ?? 'localhost') : undefined;
  }
  // connect(port, host)。port は数字の文字列でもよく、数字でない文字列はパイプのパス
  const isPort = typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first));
  if (!isPort) return undefined;
  return typeof second === 'string' ? second : 'localhost';
}

beforeAll(() => {
  net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
    const host = hostOf(args);
    if (host != undefined && !loopbackHosts.has(host)) {
      blocked.push(host);
      throw new Error(`模擬していない通信です（TEST-06）: ${host}。MSW などで模擬してください`);
    }
    return Reflect.apply(originalConnect, this, args) as net.Socket;
  } as typeof originalConnect;
});

// アプリが通信の失敗を握りつぶしても気づけるよう、止めたものを毎回確かめる
afterEach(() => {
  expect(blocked.splice(0), '模擬していない通信（TEST-06）').toEqual([]);
});

// setupFiles はテストファイルごとに実行されるので、戻さないと同じワーカーで包み直しが重なる
afterAll(() => {
  net.Socket.prototype.connect = originalConnect;
});
