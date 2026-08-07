/**
 * 素材上传中转云函数（upload-asset）
 *
 * 用法（HTTP POST, JSON）：
 *   { "path": "assets/hero/liubei.png", "data": "<base64>", "contentType": "image/png" }
 *   空参数调用（{}）返回探测信息：环境变量键名 / 是否有 TOS 凭证 / envId
 *
 * 返回：{ code:0, data:{key,etag}, url } 或 { code:1..n, message }
 */
const TOS = require('@volcengine/tos-sdk');
const { dySDK } = require('@open-dy/node-server-sdk');

const REGION = 'cn-beijing';
const ENDPOINT = 'tos-cn-beijing.volces.com';

function pickCred(env) {
  const cands = [
    ['TOS_ACCESS_KEY_ID', 'TOS_SECRET_ACCESS_KEY', 'TOS_SECURITY_TOKEN'],
    ['TOS_ACCESS_KEY', 'TOS_SECRET_KEY', 'TOS_TOKEN'],
    ['VOLC_ACCESSKEY', 'VOLC_SECRETKEY', 'VOLC_SESSION_TOKEN'],
    ['DYCLOUD_ACCESS_KEY_ID', 'DYCLOUD_SECRET_ACCESS_KEY', 'DYCLOUD_SECURITY_TOKEN'],
    ['accessKeyId', 'secretAccessKey', 'securityToken'],
    ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'],
  ];
  for (const [a, b, c] of cands) {
    if (env[a] && env[b]) {
      return { accessKeyId: env[a], secretAccessKey: env[b], securityToken: env[c] || undefined };
    }
  }
  return null;
}

module.exports = async function (params, context) {
  try {
    const env = process.env || {};
    const envKeys = Object.keys(env);
    const cred = pickCred(env);
    let ctx = {};
    try { ctx = dySDK.context(context).getContext() || {}; } catch (e) { /* ignore */ }
    const bucket = ctx.envId || env.DYCLOUD_ENV_ID || env.TCE_ENV_ID || (params && params.envId);

    // 探测模式：不带 path/data 时返回环境信息（值只显示长度，不泄露）
    if (!params || !params.path || !params.data) {
      const envInfo = {};
      envKeys.forEach((k) => {
        if (/KEY|SECRET|TOKEN|TOS|VOLC|AWS|STS|CRED/i.test(k)) envInfo[k] = String(env[k]).length;
      });
      return {
        code: 0,
        probe: true,
        bucket,
        appId: ctx.appId,
        envId: ctx.envId,
        hasCred: !!cred,
        credKeys: cred ? Object.keys(cred) : [],
        envKeys,
        sensitiveEnv: envInfo,
      };
    }

    if (!cred) {
      return { code: 1, message: 'no tos credential in env', envKeys };
    }
    if (!bucket) {
      return { code: 1, message: 'no envId/bucket available', envKeys };
    }

    const client = new TOS({
      accessKeyId: cred.accessKeyId,
      secretAccessKey: cred.secretAccessKey,
      securityToken: cred.securityToken,
      endpoint: ENDPOINT,
      region: REGION,
    });

    const buf = Buffer.from(params.data, 'base64');
    const res = await client.putObject({
      bucket,
      key: params.path,
      body: buf,
      contentType: params.contentType || 'application/octet-stream',
    });
    return {
      code: 0,
      data: {
        key: params.path,
        bytes: buf.length,
        etag: (res.data && (res.data['x-tos-hash-crc64ecma'] || res.data.etag)) || '',
      },
      url: `https://${bucket}.${ENDPOINT}/${params.path}`,
    };
  } catch (e) {
    return { code: 2, message: String((e && e.message) || e), stack: String((e && e.stack) || '').slice(0, 800) };
  }
};
