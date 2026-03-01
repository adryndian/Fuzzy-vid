import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

export async function handleStorageRequest(
  request: Request,
  env: Env,
  url: URL,
  _ctx: ExecutionContext,
  creds: Credentials
): Promise<Response> {
  const { method } = request
  const { pathname, searchParams } = url

  // GET /api/storage/file/:key — serve file from R2
  if (method === 'GET' && pathname.startsWith('/api/storage/file/')) {
    try {
      const key = pathname.replace('/api/storage/file/', '')
      if (!key) {
        return Response.json({ error: 'Missing file key' }, { status: 400 })
      }

      const object = await env.STORY_STORAGE.get(key)
      if (!object) {
        return Response.json({ error: 'File not found' }, { status: 404 })
      }

      const headers = new Headers()
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
      headers.set('Cache-Control', 'public, max-age=86400')
      // CORS handled by index.ts wrapper

      return new Response(object.body, { headers })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return Response.json({ error: 'Failed to serve file', message: msg }, { status: 500 })
    }
  }

  // GET /api/storage/test — test R2 connection
  if (method === 'GET' && pathname.endsWith('/test')) {
    try {
      const accountId = creds.r2AccountId
      const accessKeyId = creds.r2AccessKeyId
      const secretAccessKey = creds.r2SecretAccessKey
      const bucketName = creds.r2Bucket || 'igome-story-storage'

      if (!accountId || !accessKeyId || !secretAccessKey) {
        return Response.json({ error: 'Missing R2 credentials' }, { status: 400 })
      }

      const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`
      const urlToSign = new URL(`${r2Endpoint}/${bucketName}?list-type=2&max-keys=1`)

      const signer = new AwsV4Signer({
        awsAccessKeyId: accessKeyId,
        awsSecretKey: secretAccessKey,
      }, 'auto', 's3')

      const requestToSign = new Request(urlToSign, { method: 'GET' })
      const signedRequest = await signer.sign(requestToSign)
      const res = await fetch(signedRequest)

      if (res.ok) {
        return Response.json({ ok: true, message: 'R2 Storage connected!' })
      } else {
        const errText = await res.text()
        return Response.json({ error: 'R2 connection failed', details: errText }, { status: res.status })
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return Response.json({ error: 'Internal Server Error', message: msg }, { status: 500 })
    }
  }

  // GET /api/storage/presign?key=...
  if (method === 'GET' && pathname.endsWith('/presign')) {
    try {
      const key = searchParams.get('key')
      if (!key) {
        return Response.json({ error: 'Bad Request', message: 'Missing "key" query parameter' }, { status: 400 })
      }

      const r2Endpoint = `https://${creds.r2AccountId}.r2.cloudflarestorage.com`
      const bucketName = creds.r2Bucket || 'igome-story-storage'
      const urlToSign = new URL(`${r2Endpoint}/${bucketName}/${key}`)

      const signer = new AwsV4Signer({
        awsAccessKeyId: creds.r2AccessKeyId,
        awsSecretKey: creds.r2SecretAccessKey,
      }, 'auto', 's3')

      const requestToSign = new Request(urlToSign, { method: 'GET' })
      const signedRequest = await signer.sign(requestToSign)

      return Response.json({ signedUrl: signedRequest.url })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return Response.json({ error: 'Internal Server Error', message: msg }, { status: 500 })
    }
  }

  return Response.json({ error: 'Not Found', message: `Method ${method} on ${pathname} not found` }, { status: 404 })
}
