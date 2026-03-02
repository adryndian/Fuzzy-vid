import type { Env, Credentials } from './index'
import { AwsV4Signer } from './lib/aws-signature'

const WORKER_URL = 'https://fuzzy-vid-worker.officialdian21.workers.dev'

interface VideoRequestBody {
  image_url: string
  prompt: string
  scene_number: number
  project_id: string
  aspect_ratio: string
}

function getDimension(aspect: string): string {
  switch (aspect) {
    case '16_9': return '1280x720'
    default:     return '720x1280' // 9:16 and others
  }
}

export async function handleVideoRequest(
  request: Request,
  env: Env,
  url: URL,
  _ctx: ExecutionContext,
  creds: Credentials
): Promise<Response> {
  const path = url.pathname

  // POST /api/video/generate — start Nova Reel async invocation
  if (path === '/api/video/generate' && request.method === 'POST') {
    try {
      const body = await request.json() as VideoRequestBody
      const { image_url, prompt, scene_number, project_id, aspect_ratio } = body

      if (!prompt || !image_url) {
        return Response.json(
          { error: 'Bad Request', message: 'Missing prompt or image_url' },
          { status: 400 }
        )
      }

      if (!creds.awsAccessKeyId || !creds.awsSecretAccessKey) {
        return Response.json(
          { error: 'Missing AWS credentials', message: 'Add AWS credentials in Settings' },
          { status: 400 }
        )
      }

      // Nova Reel is ONLY in us-east-1
      const region = 'us-east-1'
      const modelId = 'amazon.nova-reel-v1:0'
      const dimension = getDimension(aspect_ratio)

      // Output location in R2 via S3-compatible API
      const r2AccountId = creds.r2AccountId || env.R2_ACCOUNT_ID
      const outputKey = `projects/${project_id}/scene_${scene_number}/video_${Date.now()}`
      const s3OutputUri = `s3://igome-story-storage/${outputKey}`

      // Nova Reel StartAsyncInvoke endpoint
      const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/async-invoke`

      const bedrockBody = JSON.stringify({
        modelInput: {
          taskType: 'TEXT_VIDEO',
          textToVideoParams: {
            text: prompt,
          },
          videoGenerationConfig: {
            durationSeconds: 6,
            fps: 24,
            dimension,
            seed: Math.floor(Math.random() * 1000000),
          },
        },
        outputDataConfig: {
          s3OutputDataConfig: {
            s3Uri: s3OutputUri,
          },
        },
      })

      const signer = new AwsV4Signer(
        { awsAccessKeyId: creds.awsAccessKeyId, awsSecretKey: creds.awsSecretAccessKey },
        region,
        'bedrock'
      )
      const req = new Request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bedrockBody,
      })
      const signedReq = await signer.sign(req)
      const res = await fetch(signedReq)

      if (!res.ok) {
        const errText = await res.text()
        console.error('Nova Reel StartAsyncInvoke error:', errText)
        return Response.json(
          { error: 'Video generation failed to start', message: errText.slice(0, 300) },
          { status: 502 }
        )
      }

      const data = await res.json() as { invocationArn: string }
      const invocationArn = data.invocationArn

      // Store job status in KV for polling
      const jobId = `vid_${Date.now()}_${scene_number}`
      await env.JOB_STATUS.put(jobId, JSON.stringify({
        status: 'processing',
        invocationArn,
        outputKey,
        r2AccountId,
      }), { expirationTtl: 7200 })

      // Return job info — video generation is async (takes 2-5 min)
      return Response.json({
        video_url: null,
        job_id: jobId,
        status: 'processing',
        message: 'Video generation started. Nova Reel takes 2-5 minutes. Poll /api/video/status/{job_id} for updates.',
      })

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Video handler error:', msg)
      return Response.json(
        { error: 'Internal Server Error', message: msg },
        { status: 500 }
      )
    }
  }

  // GET /api/video/status/:jobId — check async video status
  if (path.startsWith('/api/video/status/') && request.method === 'GET') {
    try {
      const jobId = path.split('/').pop()
      if (!jobId) {
        return Response.json({ error: 'Missing job ID' }, { status: 400 })
      }

      const raw = await env.JOB_STATUS.get(jobId)
      if (!raw) {
        return Response.json({ status: 'not_found' }, { status: 404 })
      }

      const jobData = JSON.parse(raw) as {
        status: string
        invocationArn?: string
        outputKey?: string
        video_url?: string
        errorCount?: number
        lastError?: string
      }

      // If already done or failed, return as-is
      if (jobData.status === 'done' || jobData.status === 'failed') {
        return Response.json(jobData)
      }

      // Poll Bedrock for status
      if (jobData.invocationArn && creds.awsAccessKeyId && creds.awsSecretAccessKey) {
        const region = 'us-east-1'
        // Keep colons literal in path (AWS canonical URI requirement), encode only the / inside the ARN
        const arnForUrl = encodeURIComponent(jobData.invocationArn).replace(/%3A/gi, ':')
        const statusEndpoint = `https://bedrock-runtime.${region}.amazonaws.com/async-invoke/${arnForUrl}`

        const signer = new AwsV4Signer(
          { awsAccessKeyId: creds.awsAccessKeyId, awsSecretKey: creds.awsSecretAccessKey },
          region,
          'bedrock'
        )
        const req = new Request(statusEndpoint, { method: 'GET' })
        const signedReq = await signer.sign(req)
        const res = await fetch(signedReq)

        if (res.ok) {
          const statusData = await res.json() as { status: string; failureMessage?: string }
          if (statusData.status === 'Completed') {
            const videoUrl = `${WORKER_URL}/api/storage/file/${jobData.outputKey}/output.mp4`
            await env.JOB_STATUS.put(jobId, JSON.stringify({
              ...jobData,
              status: 'done',
              video_url: videoUrl,
            }), { expirationTtl: 7200 })
            return Response.json({ status: 'done', video_url: videoUrl })
          } else if (statusData.status === 'Failed') {
            const failMsg = statusData.failureMessage || 'Nova Reel generation failed'
            await env.JOB_STATUS.put(jobId, JSON.stringify({
              ...jobData,
              status: 'failed',
              lastError: failMsg,
            }), { expirationTtl: 7200 })
            return Response.json({ status: 'failed', message: failMsg })
          }
          // Still InProgress — reset error count since we got a valid response
          if (jobData.errorCount) {
            await env.JOB_STATUS.put(jobId, JSON.stringify({ ...jobData, errorCount: 0 }), { expirationTtl: 7200 })
          }
        } else {
          // Bedrock status check failed — track consecutive errors
          const errText = await res.text()
          console.error(`Bedrock status check failed (${res.status}):`, errText.slice(0, 200))
          const errorCount = (jobData.errorCount || 0) + 1
          if (errorCount >= 5) {
            // After 5 consecutive API errors, mark as failed
            const errMsg = `Bedrock status check failed after ${errorCount} attempts: HTTP ${res.status}`
            await env.JOB_STATUS.put(jobId, JSON.stringify({
              ...jobData,
              status: 'failed',
              lastError: errMsg,
            }), { expirationTtl: 7200 })
            return Response.json({ status: 'failed', message: errMsg })
          }
          await env.JOB_STATUS.put(jobId, JSON.stringify({
            ...jobData,
            errorCount,
            lastError: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
          }), { expirationTtl: 7200 })
          return Response.json({
            status: 'processing',
            message: `Status check error (${errorCount}/5): HTTP ${res.status}`,
          })
        }
      }

      return Response.json({ status: 'processing', message: 'Video still generating...' })

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return Response.json({ error: 'Status check failed', message: msg }, { status: 500 })
    }
  }

  return Response.json({ error: 'Not Found' }, { status: 404 })
}
