
// A stripped-down and simplified version of AWS V4 signer for Cloudflare Workers.
// Based on https://github.com/Cloudflare/workers-sdk/blob/main/templates/worker-aws-s3-presigned-urls/src/aws.ts

function encodeURIPath(path: string): string {
  // Decode first to prevent double-encoding
  const decodedPath = decodeURIComponent(path);
  return decodedPath
    .split('/')
    .map(segment =>
      encodeURIComponent(segment)
        // AWS requires encoding these characters which encodeURIComponent ignores
        .replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
        .replace(/%2F/gi, '/')  // keep slash literal
        .replace(/%3A/gi, ':')  // keep colon literal — AWS canonical URI requires literal ':'
    )
    .join('/')
}

export class AwsV4Signer {
    constructor(
        private readonly credentials: {
            awsAccessKeyId: string;
            awsSecretKey: string;
            awsSessionToken?: string;
        },
        private readonly region: string,
        private readonly service: string
    ) {}

    async sign(request: Request): Promise<Request> {
        const url = new URL(request.url);
        const headers = new Headers(request.headers);

        const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const date = timestamp.substring(0, 8);

        headers.set('host', url.hostname);
        headers.set('x-amz-date', timestamp);
        if (this.credentials.awsSessionToken) {
            headers.set('x-amz-security-token', this.credentials.awsSessionToken);
        }

        const signedHeaders = this.getSignedHeaders(headers);
        const canonicalRequest = await this.createCanonicalRequest(
            request,
            headers,
            signedHeaders
        );
        const scope = `${date}/${this.region}/${this.service}/aws4_request`;
        const stringToSign = await this.createStringToSign(
            timestamp,
            scope,
            canonicalRequest
        );
        const signingKey = await this.getSigningKey(date);
        const signature = await this.getSignature(signingKey, stringToSign);

        const authorization = `AWS4-HMAC-SHA256 Credential=${this.credentials.awsAccessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
        headers.set('Authorization', authorization);

        const signedRequest = new Request(request.url, {
            method: request.method,
            headers,
            body: request.body,
        });

        return signedRequest;
    }

    private getSignedHeaders(headers: Headers): string {
        const headerNames: string[] = [];
        headers.forEach((_, key) => {
            headerNames.push(key.toLowerCase());
        });
        headerNames.sort();
        return headerNames.join(';');
    }

    private async createCanonicalRequest(
        request: Request,
        headers: Headers,
        signedHeaders: string
    ): Promise<string> {
        const url = new URL(request.url);
        const body = request.method === 'GET' || request.method === 'HEAD' ? '' : (await request.clone().text()) || '';
        const bodyHash = this.hex(await this.sha256(body));
        
        const canonicalHeaders: string[] = [];
        const headerEntries: [string, string][] = [];
        headers.forEach((value, key) => {
            headerEntries.push([key.toLowerCase(), value]);
        });
        headerEntries.sort(([a], [b]) => a.localeCompare(b));
        
        for (const [name, value] of headerEntries) {
            canonicalHeaders.push(`${name}:${value}`);
        }
        
        const searchParams = new URLSearchParams(url.search);
        searchParams.sort();
        
        const canonicalQuery = searchParams.toString();

        return [
            request.method.toUpperCase(),
            encodeURIPath(url.pathname),
            canonicalQuery,
            canonicalHeaders.join('\n') + '\n',
            signedHeaders,
            bodyHash,
        ].join('\n');
    }

    private async createStringToSign(
        timestamp: string,
        scope: string,
        canonicalRequest: string
    ): Promise<string> {
        return [
            'AWS4-HMAC-SHA256',
            timestamp,
            scope,
            this.hex(await this.sha256(canonicalRequest)),
        ].join('\n');
    }
    
    private async getSignature(key: CryptoKey, stringToSign: string): Promise<string> {
        const signature = await crypto.subtle.sign(
            { name: 'HMAC', hash: 'SHA-256' },
            key,
            new TextEncoder().encode(stringToSign)
        );
        return this.hex(signature);
    }
    
    private async hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
    }
    
    private async getSigningKey(date: string): Promise<CryptoKey> {
        const key = new TextEncoder().encode('AWS4' + this.credentials.awsSecretKey);
        const dateKey = await this.hmac(key, date);
        const dateRegionKey = await this.hmac(dateKey, this.region);
        const dateRegionServiceKey = await this.hmac(dateRegionKey, this.service);
        const signingKeyData = await this.hmac(dateRegionServiceKey, 'aws4_request');
        return crypto.subtle.importKey('raw', signingKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    }

    private async sha256(data: string): Promise<ArrayBuffer> {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    }
    
    private hex(buffer: ArrayBuffer): string {
        return Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    private uriEncode(str: string): string {
        return encodeURIComponent(str).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }
}

export async function signRequest(params: {
    method: string;
    url: string;
    region: string;
    service: string;
    accessKeyId: string;
    secretAccessKey: string;
    body: string;
    headers: Record<string, string>;
}): Promise<Headers> {
    const signer = new AwsV4Signer(
        { awsAccessKeyId: params.accessKeyId, awsSecretKey: params.secretAccessKey },
        params.region,
        params.service
    );
    
    const request = new Request(params.url, {
        method: params.method,
        headers: params.headers,
        body: params.body
    });

    const signedRequest = await signer.sign(request);
    return signedRequest.headers;
}
