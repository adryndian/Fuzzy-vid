
import { Env } from './index';
import { AwsV4Signer } from './lib/aws-signature';
import { corsHeaders } from './lib/cors';

export async function handleStorageRequest(request: Request, credentials: any, url: URL, ctx: ExecutionContext): Promise<Response> {
    const { method } = request;
    const { pathname, searchParams } = url;

    // Endpoint: GET /api/storage/test
    if (method === 'GET' && pathname.endsWith('/test')) {
      try {
        const accountId = credentials.r2AccountId;
        const accessKeyId = credentials.r2AccessKeyId;
        const secretAccessKey = credentials.r2SecretAccessKey;
        const bucketName = credentials.r2Bucket || 'igome-story-storage';

        if (!accountId || !accessKeyId || !secretAccessKey) {
          return new Response(JSON.stringify({ error: 'Missing R2 credentials' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
        // We'll do a simple list objects request to test the credentials
        const urlToSign = new URL(`${r2Endpoint}/${bucketName}?list-type=2&max-keys=1`);
        
        const signer = new AwsV4Signer({
            awsAccessKeyId: accessKeyId,
            awsSecretKey: secretAccessKey,
        }, 'auto', 's3');

        const requestToSign = new Request(urlToSign, { method: 'GET' });
        const signedRequest = await signer.sign(requestToSign);

        const res = await fetch(signedRequest);

        if (res.ok) {
          return new Response(JSON.stringify({ ok: true, message: 'R2 Storage connected!' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          const errText = await res.text();
          return new Response(JSON.stringify({ error: 'R2 connection failed', details: errText }), {
            status: res.status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error: any) {
        return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Endpoint: GET /api/storage/presign?key=...
    if (method === 'GET' && pathname.endsWith('/presign')) {
      try {
        const key = searchParams.get('key');

        if (!key) {
          const errorResponse = { error: 'Bad Request', message: 'Missing "key" query parameter' };
          return new Response(JSON.stringify(errorResponse), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        const r2Endpoint = `https://${credentials.r2AccountId}.r2.cloudflarestorage.com`;
        const bucketName = credentials.r2Bucket || 'igome-story-storage';
        const urlToSign = new URL(`${r2Endpoint}/${bucketName}/${key}`);

        const signer = new AwsV4Signer({
            awsAccessKeyId: credentials.r2AccessKeyId,
            awsSecretKey: credentials.r2SecretAccessKey,
        }, 'auto', 's3');

        const requestToSign = new Request(urlToSign, {
            method: 'GET',
        });

        // Sign a fake request to generate the presigned URL with authentication query parameters
        const signedRequest = await signer.sign(requestToSign);
        const signedUrl = signedRequest.url;
        
        const response = { signedUrl };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error: any) {
        console.error('Error generating presigned URL:', error);
        const errorResponse = { error: 'Internal Server Error', message: error.message };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const notFoundResponse = { error: 'Not Found', message: `Method ${method} on ${pathname} not found` };
    return new Response(JSON.stringify(notFoundResponse), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
