/**
 * 编译期检查：项目中声明的微信 API 子集（WxApi）必须能由微信官方类型 minigame-api-typings 赋值。
 * 如果把接口名写错或参数结构与官方不符，这里会编译失败。
 * 运行：npx tsc -p tsconfig.wxcompat.json
 */
import type { WxApi } from '../../assets/scripts/platform/MiniGameApi';

declare const officialWx: WechatMinigame.Wx;
// Required<>：每个方法都必须真实存在于官方类型中（可选属性本身无法发现拼写错误）
export const compat: Required<WxApi> = officialWx;
